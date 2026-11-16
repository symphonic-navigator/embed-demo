// Live sentences from Tatoeba (tatoeba.org, CC BY 2.0 FR). Everything the API
// returns is untrusted: it is checked for shape and length here and later
// rendered as plain text only.

export const TATOEBA_API = 'https://api.tatoeba.org/v1/sentences'
export const MAX_TEXT_LENGTH = 300
const TIMEOUT_MS = 15000
// Everything is credited as CC BY 2.0 FR; CC0 sentences may be credited that way too.
const LICENCES = ['CC BY 2.0 FR', 'CC0 1.0']
const TRANSLATION_LANGS = ['fra', 'deu', 'eng']

export class TatoebaError extends Error {}

export function randomSentenceUrl() {
  const params = new URLSearchParams({
    lang: 'jpn',
    sort: 'random',
    limit: '1',
    'trans:lang': 'fra',
    'showtrans:lang': TRANSLATION_LANGS.join(','),
    word_count: '4-20', // for Japanese this counts characters
    is_unapproved: 'no',
  })
  return `${TATOEBA_API}?${params}`
}

function clean(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { id, lang, license } = raw
  if (!Number.isInteger(id) || id <= 0) return null
  if (raw.is_unapproved === true || !LICENCES.includes(license)) return null
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text || text.length > MAX_TEXT_LENGTH) return null
  return { id, lang, text } // lang is checked by the callers against a fixed list
}

// Returns the Japanese sentence followed by at most one translation per
// language, preferring direct translations.
export function parseTatoebaResponse(json) {
  const data = json?.data
  if (!Array.isArray(data) || data.length === 0) throw new TatoebaError('Tatoeba sent no sentence.')
  const main = clean(data[0])
  if (!main || main.lang !== 'jpn') throw new TatoebaError('Tatoeba sent a sentence we could not use.')

  const translations = Array.isArray(data[0].translations) ? data[0].translations : []
  const ordered = translations.slice(0, 50).sort((a, b) => Number(b?.is_direct === true) - Number(a?.is_direct === true))
  const picked = new Map()
  for (const raw of ordered) {
    const t = clean(raw)
    if (t && TRANSLATION_LANGS.includes(t.lang) && !picked.has(t.lang)) picked.set(t.lang, t)
  }
  return [main, ...picked.values()]
}

export async function fetchRandomSentences(fetchFn = fetch) {
  let json
  try {
    const res = await fetchFn(randomSentenceUrl(), { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new TatoebaError(`Tatoeba answered with status ${res.status}.`)
    json = await res.json()
  } catch (err) {
    if (err instanceof TatoebaError) throw err
    if (err?.name === 'TimeoutError') throw new TatoebaError('Tatoeba is taking too long to answer. Try again later.')
    throw new TatoebaError('Could not reach Tatoeba. Are you offline?')
  }
  return parseTatoebaResponse(json)
}
