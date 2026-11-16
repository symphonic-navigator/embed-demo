import { useState } from 'react'
import { MAX_TOKENS } from '../config.js'
import ThingsToTry from './ThingsToTry.jsx'

const SOFT_LIMIT = 50

export default function MyTextsTab({ store, entries, refresh, run, perform, busy }) {
  const [draft, setDraft] = useState('')
  const [truncatedHint, setTruncatedHint] = useState(false)
  const texts = entries['my-texts']

  const add = () => {
    const text = draft.trim()
    if (!text) return
    return perform('Embedding your text', async () => {
      const { vectors, truncated } = await run('Embedding your text', [text], 'passage')
      await store.add('my-texts', { text, vector: vectors[0], truncated: truncated[0] })
      setTruncatedHint(truncated[0])
      setDraft('')
      await refresh('my-texts')
    })
  }

  const remove = (id) =>
    perform('Deleting', async () => {
      await store.remove(id)
      await refresh('my-texts')
    })

  const clearAll = () =>
    perform('Clearing your texts', async () => {
      await store.clear('my-texts')
      await refresh('my-texts')
    })

  return (
    <div className="tab-panel">
      <p className="warning">Stored only in this browser and not backed up. Don&apos;t put anything important or secret here.</p>
      <div className="my-texts">
        <div>
          <label htmlFor="new-text">One text per entry</label>
          <textarea id="new-text" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="actions">
            <button className="primary" onClick={add} disabled={busy || !store || !draft.trim()}>
              Add &amp; embed
            </button>
            {texts.length >= SOFT_LIMIT ? (
              <span className="muted">
                That is a lot of texts. It still works, but every new one takes a few seconds and the list gets long.
              </span>
            ) : null}
          </div>
          {truncatedHint ? (
            <p className="note">
              That text was longer than {MAX_TOKENS} tokens, so only its beginning was embedded. One vector for a whole
              novel says little anyway: real systems cut long texts into chunks and embed each one.
            </p>
          ) : null}
        </div>
        <ThingsToTry />
      </div>

      {texts.length === 0 ? (
        <p className="muted">No texts yet. Add a few, then search them.</p>
      ) : (
        <div className="entries">
          <div className="entries-head">
            <span>
              {texts.length} {texts.length === 1 ? 'text' : 'texts'}
            </span>
            <button className="secondary" onClick={clearAll} disabled={busy}>
              Clear all
            </button>
          </div>
          <ul>
            {texts.map((t) => (
              <li key={t.id}>
                <span className="entry-text">{t.text}</span>
                {t.truncated ? <span className="muted"> (only the first {MAX_TOKENS} tokens count)</span> : null}
                <button className="link" onClick={() => remove(t.id)} disabled={busy} aria-label={`Delete “${t.text.slice(0, 30)}”`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
