import { useState } from 'react'
import { fetchRandomSentences, TatoebaError } from '../lib/tatoeba.js'

export default function DemoSetTab({ store, entries, refresh, run, perform, isCurated, busy }) {
  const [message, setMessage] = useState(null)

  const fetchMore = () =>
    perform('Asking Tatoeba', async () => {
      setMessage(null)
      try {
        await addFromTatoeba()
      } catch (err) {
        if (!(err instanceof TatoebaError)) throw err
        setMessage(`${err.message} The demo set still works as it is.`)
      }
    })

  const addFromTatoeba = async () => {
    const sentences = await fetchRandomSentences()
    const fresh = []
    for (const s of sentences) {
      if (!isCurated(s.id) && !(await store.hasSource('tatoeba', s.id))) fresh.push(s)
    }
    if (fresh.length === 0) {
      setMessage('Those sentences are already in the set. Try again for different ones.')
      return
    }
    const { vectors } = await run('Embedding Tatoeba sentences', fresh.map((s) => s.text), 'passage')
    for (let i = 0; i < fresh.length; i++) {
      await store.add('tatoeba', { text: fresh[i].text, lang: fresh[i].lang, sourceId: fresh[i].id, vector: vectors[i] })
    }
    await refresh('tatoeba')
    setMessage(`Added ${fresh.length} sentences from Tatoeba.`)
  }

  const reset = () =>
    perform('Resetting the demo set', async () => {
      await store.clear('tatoeba')
      await refresh('tatoeba')
      setMessage('The demo set is back to the curated sentences.')
    })

  return (
    <div className="tab-panel">
      <p>
        About 40 short sentences from Tatoeba, mostly Japanese, on clearly different topics. Some have their French,
        German or English translation in the set, so you can check that a hit across languages is right. Their
        vectors were computed in advance with the same model; only your query is embedded now.
      </p>
      <div className="actions">
        <button className="secondary" onClick={fetchMore} disabled={busy || !store}>
          Fetch random sentences from Tatoeba
        </button>
        <button className="secondary" onClick={reset} disabled={busy || !store || entries.tatoeba.length === 0}>
          Reset demo set
        </button>
        {entries.tatoeba.length ? <span className="muted">{entries.tatoeba.length} fetched sentences added</span> : null}
      </div>
      {message ? (
        <p className="muted" role="status">
          {message}
        </p>
      ) : null}
      <p className="muted">Sentences from Tatoeba (tatoeba.org), CC BY 2.0 FR.</p>
    </div>
  )
}
