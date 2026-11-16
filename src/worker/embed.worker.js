// Runs the model off the main thread, so the page never freezes.
// Messages in:  {type: 'load', cacheName} | {type: 'embed', id, texts, kind}
// Messages out: progress, preparing, ready, embed-progress, embedded, error
import * as ort from 'onnxruntime-web/webgpu'
import { Tokenizer } from '@huggingface/tokenizers'
// Bundled by Vite, so onnxruntime-web never fetches its WebAssembly from a CDN.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import { MAX_TOKENS, MODEL_BASE_URL, MODEL_FILES, PASSAGE_PREFIX, QUERY_PREFIX, CACHE_PREFIX } from '../config.js'
import { createSession } from '../lib/backends.js'
import { dropOtherCaches, fetchCached } from '../lib/modelCache.js'
import { l2Normalise, meanPool, truncate } from '../lib/vector.js'

ort.env.wasm.wasmPaths = { wasm: wasmUrl }

let session
let tokenizer

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
const jsonFrom = (buffer) => JSON.parse(new TextDecoder().decode(buffer))

async function load(cacheName) {
  await dropOtherCaches(CACHE_PREFIX, cacheName)
  const url = (name) => MODEL_BASE_URL + name
  const [tokenizerJson, tokenizerConfig, modelBytes] = await Promise.all([
    fetchCached(url(MODEL_FILES.tokenizer), cacheName),
    fetchCached(url(MODEL_FILES.tokenizerConfig), cacheName),
    fetchCached(url(MODEL_FILES.model), cacheName, (loaded, total) =>
      postMessage({ type: 'progress', loaded, total }),
    ),
  ])
  postMessage({ type: 'preparing' })
  tokenizer = new Tokenizer(jsonFrom(tokenizerJson), jsonFrom(tokenizerConfig))
  const fingerprint = hex(await crypto.subtle.digest('SHA-256', modelBytes))
  const created = await createSession(ort, new Uint8Array(modelBytes), Boolean(navigator.gpu))
  session = created.session
  postMessage({ type: 'ready', backend: created.backend, fingerprint })
}

async function embedOne(text, prefix) {
  const all = tokenizer.encode(prefix + text).ids
  const ids = truncate(all, MAX_TOKENS)
  const n = ids.length
  const out = await session.run({
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, n]),
    attention_mask: new ort.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]),
  })
  const hidden = out.last_hidden_state
  const vector = l2Normalise(meanPool(hidden.data, n, hidden.dims[2], new Array(n).fill(1)))
  hidden.dispose?.()
  return { vector, truncated: all.length > ids.length }
}

async function embed({ id, texts, kind }) {
  const prefix = kind === 'query' ? QUERY_PREFIX : PASSAGE_PREFIX
  const vectors = []
  const truncated = []
  for (let i = 0; i < texts.length; i++) {
    postMessage({ type: 'embed-progress', id, done: i, total: texts.length })
    const r = await embedOne(texts[i], prefix)
    vectors.push(r.vector)
    truncated.push(r.truncated)
  }
  postMessage({ type: 'embedded', id, vectors, truncated }, vectors.map((v) => v.buffer))
}

// One message at a time: the model can only run one inference anyway.
let queue = Promise.resolve()
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      if (data.type === 'load') await load(data.cacheName)
      else if (data.type === 'embed') await embed(data)
    } catch (err) {
      postMessage({ type: 'error', id: data.id, message: String(err?.message ?? err) })
    }
  })
}
