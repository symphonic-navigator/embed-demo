// Smoke check of the built app in headless Chromium, against the local model
// (spec §7 steps 1–8 plus the network rules of spec §9).
//
//   pnpm smoke
//
// Needs the exported model in tools/model/out/ (see tools/model/export.py).
// Starts `pnpm serve-model` if port 8765 is free, builds the app with
// VITE_MODEL_BASE_URL=http://localhost:8765/ and serves it with vite preview.
// CHROMIUM_PATH can point at a browser binary when Playwright's own is missing.
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConnection } from 'node:net'
import { chromium } from 'playwright'

const MODEL_PORT = 8765
const PREVIEW_PORT = 4173
const MODEL_ORIGIN = `http://localhost:${MODEL_PORT}`
const SITE = `http://localhost:${PREVIEW_PORT}/embed-demo/`
const ALLOWED_ORIGINS = [`http://localhost:${PREVIEW_PORT}`, MODEL_ORIGIN, 'https://api.tatoeba.org']
const LOAD_TIMEOUT = 10 * 60 * 1000
const EMBED_TIMEOUT = 3 * 60 * 1000

const children = []
const timings = {}
let failures = 0

function check(ok, message) {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${message}`)
  if (!ok) failures++
}

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = createConnection(port, 'localhost')
    socket.once('connect', () => (socket.end(), resolve(true)))
    socket.once('error', () => resolve(false))
  })

async function waitForPort(port) {
  for (let i = 0; i < 100; i++) {
    if (await portInUse(port)) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Nothing is listening on port ${port}`)
}

function start(command, args, env = {}) {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } })
  children.push(child)
  return child
}

function guardNetwork(page, seen) {
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.protocol === 'data:' || url.protocol === 'blob:') return
    seen.push(req.url())
    if (!ALLOWED_ORIGINS.includes(url.origin)) {
      check(false, `request to a host outside the allowed list: ${req.url()}`)
    }
  })
}

const modelRequests = (seen) => seen.filter((u) => u.startsWith(MODEL_ORIGIN) && u.endsWith('.onnx'))

async function waitUntilReady(page) {
  const started = Date.now()
  await page.getByRole('button', { name: 'You can explore vector embeddings now' }).waitFor({ timeout: LOAD_TIMEOUT })
  return Date.now() - started
}

async function waitForSearch(page) {
  await page.locator('.inference.busy').waitFor({ state: 'detached', timeout: EMBED_TIMEOUT })
}

const boundaryAfterRank = (page, kind) =>
  page.evaluate((kind) => {
    const line = document.querySelector(`.boundary.${kind}, .boundary.both`)
    return line ? Number(line.previousElementSibling.dataset.rank) : null
  }, kind)

async function main() {
  if (!(await portInUse(MODEL_PORT))) start('node', ['scripts/serve-model.mjs'])
  await waitForPort(MODEL_PORT)
  execSync('pnpm build', { stdio: 'inherit', env: { ...process.env, VITE_MODEL_BASE_URL: `${MODEL_ORIGIN}/` } })
  start('pnpm', ['exec', 'vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'])
  await waitForPort(PREVIEW_PORT)

  const options = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  // A real (persistent) profile: incognito-like contexts refuse to keep a
  // 1.25 GB file in the Cache API, just as incognito windows do.
  const profile = mkdtempSync(join(tmpdir(), 'embed-demo-smoke-'))
  const context = await chromium.launchPersistentContext(profile, { ...options, viewport: { width: 1360, height: 900 } })
  try {
    await desktop(context)
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
  const browser = await chromium.launch(options)
  try {
    await phone(browser)
  } finally {
    await browser.close()
  }
}

async function desktop(context) {
  const page = await context.newPage()
  const seen = []
  const warnings = []
  guardNetwork(page, seen)
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()))
  page.on('pageerror', (e) => check(false, `page error: ${e.message}`))

  console.log('Step 1: the Explainer appears with a loading status')
  await page.goto(SITE)
  check(await page.getByRole('heading', { name: 'What is an embedding?' }).isVisible(), 'Explainer is visible')
  await page.getByText('Loading the embedding model Nemotron-3-Embed-1B (int8) — have a look around…').waitFor()
  check(true, 'status line names the model and quantisation')
  await page.locator('.status-bar progress').waitFor()
  check(true, 'a progress bar is shown')

  console.log('Step 2: the model loads and the button appears')
  timings.firstLoadMs = await waitUntilReady(page)
  check(modelRequests(seen).length === 1, 'model.onnx was downloaded once from the model base URL')

  console.log('Step 3: the Playground opens on the Demo set')
  await page.getByRole('button', { name: 'You can explore vector embeddings now' }).click()
  check(await page.getByRole('tab', { name: 'Demo set' }).getAttribute('aria-selected') === 'true', 'Demo set tab is active')

  console.log('Step 4: the first suggestion chip')
  const started = Date.now()
  await page.getByRole('button', { name: 'un chat qui dort' }).click()
  await page.getByText(/Embedding your query… \d+\.\d s \((CPU\/WASM|GPU\/WebGPU)\)/).waitFor()
  check(true, 'the status shows a running timer and the backend')
  await waitForSearch(page)
  timings.firstQueryMs = Date.now() - started
  const rows = page.locator('.results .row')
  check((await rows.count()) === 39, 'all 39 demo sentences are listed')
  check(/猫/.test(await rows.first().innerText()), 'a sleeping cat comes first')
  const kRank = await boundaryAfterRank(page, 'k')
  const pRank = await boundaryAfterRank(page, 'p')
  check(kRank === 4, `k line sits under rank 4 (found ${kRank})`)
  check(pRank !== null && pRank < kRank, `p line sits above the k line (under rank ${pRank})`)
  check((await page.locator('.badge.p').count()) >= 1, 'at least one row says "p too low"')
  check((await page.locator('.badge.kp').count()) >= 1, 'rows below say "k and p too low"')

  console.log('Step 5: raising the temperature moves the p line without a new search')
  const before = modelRequests(seen).length
  await page.locator('#slider-temperature').fill('0.08')
  const pRankHot = await boundaryAfterRank(page, 'p')
  check(pRankHot > kRank, `p line moved below the k line (under rank ${pRankHot})`)
  check((await page.locator('.row[data-rank="4"] .badge').count()) === 0, 'rank 4 is active again')
  check((await page.locator('.inference.busy').count()) === 0, 'no new search ran')
  check(modelRequests(seen).length === before, 'no model request')

  console.log('Step 6: hovering rank 1 shows the angle')
  await rows.first().hover()
  const info = await page.locator('.fan-info').innerText()
  check(/cos\(\d+°\) = 0\.\d\d = similarity/.test(info), `the fan explains the angle ("${info.split('\n')[1]}")`)
  check((await page.locator('.fan-point.on').count()) === 1, 'the point is highlighted in the fan')

  console.log('Step 6b: live sentences from Tatoeba')
  await page.getByRole('button', { name: 'Fetch random sentences from Tatoeba' }).click()
  await page.getByRole('status').filter({ hasText: /Added \d+ sentences|Tatoeba|already/ }).waitFor({ timeout: EMBED_TIMEOUT })
  const tatoebaMessage = await page.getByRole('status').innerText()
  console.log(`        ${tatoebaMessage}`)
  check(/Added \d+ sentences/.test(tatoebaMessage), 'sentences were fetched, embedded and stored')
  check((await rows.count()) > 39, 'the results list was re-ranked with the new sentences')
  await page.getByRole('button', { name: 'Reset demo set' }).click()
  await page.getByText('The demo set is back to the curated sentences.').waitFor()
  check((await rows.count()) === 39, 'Reset restores the curated 39')

  console.log('Step 7: My texts survive a reload')
  await page.getByRole('tab', { name: 'My texts' }).click()
  check(await page.getByText("Stored only in this browser and not backed up. Don't put anything important or secret here.").isVisible(), 'the storage warning is visible')
  const texts = [
    'Old pond, a frog jumps in, the sound of water. Autumn leaves drift on the surface.',
    'Dada! Umbrella clock bicycle, the soup sings blue numbers to the moon.',
  ]
  for (const [i, text] of texts.entries()) {
    await page.locator('#new-text').fill(text)
    await page.getByRole('button', { name: 'Add & embed' }).click()
    await page.getByText('Embedding your text…').waitFor()
    await page.locator('.inference.busy').waitFor({ state: 'detached', timeout: EMBED_TIMEOUT })
    await page.getByText(`${i + 1} text${i ? 's' : ''}`, { exact: true }).waitFor()
  }
  check(true, 'two texts added with visible progress')
  await page.getByLabel('Search query').fill('autumn')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await waitForSearch(page)
  check(/frog|Autumn/.test(await rows.first().innerText()), 'the haiku ranks first for "autumn"')

  const beforeReload = modelRequests(seen).length
  await page.reload()
  timings.cachedLoadMs = await waitUntilReady(page)
  check(modelRequests(seen).length === beforeReload, 'second load made no network request for the model')
  await page.getByRole('button', { name: 'You can explore vector embeddings now' }).click()
  await page.getByRole('tab', { name: 'My texts' }).click()
  await page.getByText('2 texts', { exact: true }).waitFor()
  check(true, 'both texts are still there after the reload')
  await page.getByRole('button', { name: 'Clear all' }).click()
  await page.getByText('No texts yet. Add a few, then search them.').waitFor()
  check(true, '"Clear all" empties the tab')

  check(!warnings.some((w) => w.includes('differs from the one the demo vectors were made with')), 'model fingerprint matches the demo set')
  check(!warnings.some((w) => w.includes('Could not keep the model')), 'the model was stored in the Cache API')
}

async function phone(browser) {
  console.log('Step 8: a phone gets the Explainer only and downloads nothing')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const seen = []
  guardNetwork(page, seen)
  await page.goto(SITE)
  await page.getByText('For the interactive demo, please open this page on a computer.').waitFor()
  check(true, 'the phone note is shown')
  await page.waitForTimeout(3000)
  check(!seen.some((u) => u.startsWith(MODEL_ORIGIN)), 'no request to the model')
  await context.close()
}

try {
  await main()
} catch (err) {
  console.error(err)
  failures++
} finally {
  for (const child of children) child.kill()
}
console.log(`\nTimings: ${JSON.stringify(timings)}`)
console.log(failures ? `\nSMOKE FAILED (${failures} problem${failures > 1 ? 's' : ''})` : '\nSMOKE PASSED')
process.exit(failures ? 1 : 0)
