// Model files are stored in the Cache API under their stable config URL.
// Hugging Face's resolve/main URLs redirect to short-lived signed CDN links,
// so the ordinary HTTP cache cannot be relied on to keep a 1.25 GB file.

export async function dropOtherCaches(prefix, keep) {
  if (!self.caches) return
  for (const name of await caches.keys()) {
    if (name.startsWith(prefix) && name !== keep) await caches.delete(name)
  }
}

export async function fetchCached(url, cacheName, onProgress = () => {}) {
  const cache = self.caches ? await caches.open(cacheName).catch(() => null) : null
  const hit = cache && (await cache.match(url))
  if (hit) {
    const buffer = await hit.arrayBuffer()
    onProgress(buffer.byteLength, buffer.byteLength)
    return buffer
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download ${url} (status ${res.status})`)
  const total = Number(res.headers.get('Content-Length')) || 0

  // One branch of the stream goes into the cache, the other is read here with
  // progress, so the file is not held in memory twice.
  const [forCache, forUs] = res.body.tee()
  const stored = cache
    ? cache
        .put(url, new Response(forCache, { headers: { 'Content-Type': 'application/octet-stream' } }))
        .catch((err) => console.warn('Could not keep the model in the browser cache:', err))
    : forCache.cancel()

  const reader = forUs.getReader()
  let bytes = new Uint8Array(total)
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (loaded + value.length > bytes.length) {
      // Content-Length was missing or wrong: grow the buffer.
      const bigger = new Uint8Array(Math.max(bytes.length * 2, loaded + value.length))
      bigger.set(bytes.subarray(0, loaded))
      bytes = bigger
    }
    bytes.set(value, loaded)
    loaded += value.length
    onProgress(loaded, total)
  }
  await stored
  return bytes.buffer.byteLength === loaded ? bytes.buffer : bytes.slice(0, loaded).buffer
}
