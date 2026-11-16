import { useEffect, useMemo, useState } from 'react'
import demoSet from '../data/demo-set.json'
import { DEFAULTS, DEMO_SUGGESTIONS } from '../data/suggestions.js'
import { rankBySimilarity, softmax, topPCount } from '../lib/ranking.js'
import { openStore } from '../lib/storage.js'
import { useMediaQuery } from '../lib/useMediaQuery.js'
import AngleFan from './AngleFan.jsx'
import Controls from './Controls.jsx'
import DemoSetTab from './DemoSetTab.jsx'
import InferenceStatus from './InferenceStatus.jsx'
import MyTextsTab from './MyTextsTab.jsx'
import ResultsList from './ResultsList.jsx'

const curated = demoSet.items.map((item) => ({ ...item, vector: Float32Array.from(item.vector) }))
const curatedById = new Map(curated.map((item) => [item.sourceId, item]))
const translationOf = (item) => (item.translationOf ? curatedById.get(item.translationOf) : null)

export default function Playground({ embedder, backend }) {
  const [tab, setTab] = useState('demo')
  const [store, setStore] = useState(null)
  const [storeError, setStoreError] = useState(null)
  const [entries, setEntries] = useState({ tatoeba: [], 'my-texts': [] })
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(null) // { text, vector }
  const [settings, setSettings] = useState(DEFAULTS)
  const [hoveredId, setHoveredId] = useState(null)
  const [busy, setBusy] = useState(null) // { label, since, done, total }
  const [last, setLast] = useState(null) // { label, ms }
  const wide = useMediaQuery('(min-width: 1000px)')

  useEffect(() => {
    openStore()
      .then(async (s) => {
        setStore(s)
        setEntries({ tatoeba: await s.list('tatoeba'), 'my-texts': await s.list('my-texts') })
      })
      .catch(() => setStoreError('This browser does not let the page store anything, so added texts will not be kept.'))
  }, [])

  const refresh = async (collection) => {
    const list = await store.list(collection)
    setEntries((e) => ({ ...e, [collection]: list }))
  }

  // Runs one embedding job with visible progress. Only one at a time.
  const run = async (label, texts, kind) => {
    const since = performance.now()
    setBusy({ label, since, done: 0, total: texts.length })
    try {
      return await embedder.embed(texts, kind, (done, total) => setBusy({ label, since, done, total }))
    } finally {
      setLast({ label: texts.length > 1 ? `Embedding ${texts.length} texts` : label, ms: performance.now() - since })
      setBusy(null)
    }
  }

  const search = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setQuery(trimmed)
    const { vectors } = await run('Embedding your query', [trimmed], 'query')
    setSearched({ text: trimmed, vector: vectors[0] })
  }

  const items = useMemo(() => (tab === 'demo' ? [...curated, ...entries.tatoeba] : entries['my-texts']), [tab, entries])
  // Re-ranks whenever the collection changes, without embedding the query again.
  const results = useMemo(() => (searched ? rankBySimilarity(searched.vector, items) : []), [searched, items])
  // Moving a slider only recomputes these, it never runs a new search.
  const probabilities = useMemo(
    () => softmax(results.map((r) => r.similarity), settings.temperature),
    [results, settings.temperature],
  )
  const pCount = topPCount(probabilities, settings.p)

  const tabProps = { store, entries, refresh, run, busy: Boolean(busy) }
  const fan = searched && results.length ? (
    <AngleFan
      query={searched.text}
      results={results}
      k={settings.k}
      pCount={pCount}
      hoveredId={hoveredId}
      onHover={setHoveredId}
    />
  ) : null

  return (
    <div className="playground">
      <div className="tabs collection-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'demo'} className={tab === 'demo' ? 'tab active' : 'tab'} onClick={() => setTab('demo')}>
          Demo set
        </button>
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'tab active' : 'tab'} onClick={() => setTab('mine')}>
          My texts
        </button>
        <span className="muted">The search always runs against the active tab only.</span>
      </div>

      {storeError ? <p className="warning">{storeError}</p> : null}
      {tab === 'demo' ? <DemoSetTab {...tabProps} /> : <MyTextsTab {...tabProps} />}

      <form
        className="query"
        onSubmit={(e) => {
          e.preventDefault()
          search(query)
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by meaning, in any language…"
          aria-label="Search query"
        />
        <button className="primary" type="submit" disabled={Boolean(busy) || !query.trim()}>
          Search
        </button>
      </form>
      {tab === 'demo' ? (
        <div className="chips" aria-label="Suggested queries">
          {DEMO_SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => search(s)} disabled={Boolean(busy)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <InferenceStatus busy={busy} last={last} backend={backend} />

      <Controls {...settings} onChange={(change) => setSettings((s) => ({ ...s, ...change }))} />

      {!searched ? (
        <p className="muted">
          {tab === 'demo' ? 'Click a suggestion or type a query to start.' : 'Type a query to search your texts.'}
        </p>
      ) : results.length === 0 ? (
        <p className="muted">This tab has no texts yet, so there is nothing to rank.</p>
      ) : (
        <div className={wide ? 'results-layout wide' : 'results-layout'}>
          <ResultsList
            results={results}
            probabilities={probabilities}
            k={settings.k}
            p={settings.p}
            pCount={pCount}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            translationOf={translationOf}
          />
          {wide ? (
            <div className="fan-column">{fan}</div>
          ) : (
            <details className="fan-details">
              <summary>Show the angles</summary>
              {fan}
            </details>
          )}
        </div>
      )}
    </div>
  )
}
