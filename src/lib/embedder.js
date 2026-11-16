// Main-thread side of the embedding worker: turns its messages into promises.
export function createEmbedder({ cacheName, onProgress, onPreparing, onReady, onError }) {
  const worker = new Worker(new URL('../worker/embed.worker.js', import.meta.url), { type: 'module' })
  const pending = new Map()
  let nextId = 1

  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id)
    switch (data.type) {
      case 'progress':
        return onProgress?.(data.loaded, data.total)
      case 'preparing':
        return onPreparing?.()
      case 'ready':
        return onReady?.(data)
      case 'embed-progress':
        return job?.onItem?.(data.done, data.total)
      case 'embedded':
        pending.delete(data.id)
        return job?.resolve({ vectors: data.vectors, truncated: data.truncated })
      case 'error':
        if (job) {
          pending.delete(data.id)
          return job.reject(new Error(data.message))
        }
        return onError?.(new Error(data.message))
    }
  }

  return {
    load: () => worker.postMessage({ type: 'load', cacheName }),
    terminate: () => worker.terminate(),
    // kind: 'query' or 'passage'. onItem(done, total) reports batch progress.
    embed(texts, kind, onItem) {
      const id = nextId++
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onItem })
        worker.postMessage({ type: 'embed', id, texts, kind })
      })
    },
  }
}
