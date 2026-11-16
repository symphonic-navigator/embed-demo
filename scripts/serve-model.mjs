// Serves the locally exported model (tools/model/out/) for development and the
// smoke check, with the CORS header the browser needs. No dependencies.
//   pnpm serve-model            → http://localhost:8765/
//   MODEL_DIR=... PORT=... pnpm serve-model
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, sep } from 'node:path'

const root = resolve(process.env.MODEL_DIR ?? 'tools/model/out')
const port = Number(process.env.PORT ?? 8765)

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  let name
  try {
    name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    return res.writeHead(400).end()
  }
  const file = resolve(root, '.' + name)
  // Never serve anything outside the model folder.
  if (!file.startsWith(root + sep)) return res.writeHead(403).end()
  let size
  try {
    const stat = statSync(file)
    if (!stat.isFile()) throw new Error('not a file')
    size = stat.size
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'Content-Length': size, 'Content-Type': 'application/octet-stream' })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://localhost:${port}/`))
