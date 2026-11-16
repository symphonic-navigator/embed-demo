import { useEffect, useState } from 'react'
import demoSet from './data/demo-set.json'
import { CACHE_PREFIX } from './config.js'
import { createEmbedder } from './lib/embedder.js'
import { isPhone } from './lib/device.js'
import Explainer from './components/Explainer.jsx'
import Footer from './components/Footer.jsx'
import LoadingStatus from './components/LoadingStatus.jsx'
import Playground from './components/Playground.jsx'

const phone = isPhone()

export default function App() {
  const [loadAnyway, setLoadAnyway] = useState(false)
  const [view, setView] = useState('explainer')
  const [opened, setOpened] = useState(false) // stops the button pulsing
  const [model, setModel] = useState({ phase: 'idle', loaded: 0, total: 0 })
  const [embedder, setEmbedder] = useState(null)
  const shouldLoad = !phone || loadAnyway

  useEffect(() => {
    if (!shouldLoad) return
    const created = createEmbedder({
      cacheName: CACHE_PREFIX + demoSet.model.sha256.slice(0, 12),
      onProgress: (loaded, total) => setModel({ phase: 'downloading', loaded, total }),
      onPreparing: () => setModel((m) => ({ ...m, phase: 'preparing', preparingSince: performance.now() })),
      onReady: ({ backend, fingerprint }) => {
        if (fingerprint !== demoSet.model.sha256) {
          console.warn(
            `The loaded model (SHA-256 ${fingerprint}) differs from the one the demo vectors were made with ` +
              `(${demoSet.model.sha256}). Re-run tools/model/embed_demo_set.py against the uploaded model.`,
          )
        }
        setModel((m) => ({ ...m, phase: 'ready', backend }))
        setEmbedder(created) // the Playground only needs it once the model is ready
      },
      onError: (error) => setModel((m) => ({ ...m, phase: 'error', error: error.message })),
    })
    created.load()
    return () => created.terminate()
  }, [shouldLoad])

  const ready = model.phase === 'ready'
  const openPlayground = () => {
    setOpened(true)
    setView('playground')
  }

  return (
    <div className="app">
      <header className="site-header">
        <h1>Vector embeddings, hands on</h1>
        {!phone || loadAnyway ? (
          <nav className="tabs" aria-label="Sections">
            <button className={view === 'explainer' ? 'tab active' : 'tab'} onClick={() => setView('explainer')}>
              Explainer
            </button>
            <button
              className={view === 'playground' ? 'tab active' : 'tab'}
              onClick={openPlayground}
              disabled={!ready}
              title={ready ? undefined : 'Available once the model has loaded'}
            >
              Playground
            </button>
          </nav>
        ) : null}
      </header>

      <main>
        <div hidden={view === 'playground' && ready}>
          <Explainer onOpenPlayground={ready ? openPlayground : null} />
        </div>
        {/* Stays mounted once opened, so query, results and sliders survive a visit to the Explainer. */}
        {ready && opened ? (
          <div hidden={view !== 'playground'}>
            <Playground embedder={embedder} backend={model.backend} />
          </div>
        ) : null}
      </main>

      {phone && !loadAnyway ? (
        <div className="status-bar">
          <p>For the interactive demo, please open this page on a computer.</p>
          <button className="link" onClick={() => setLoadAnyway(true)}>
            Load anyway (downloads about 1.25 GB)
          </button>
        </div>
      ) : view === 'explainer' || !ready ? (
        <LoadingStatus model={model} opened={opened} onOpen={openPlayground} />
      ) : null}

      <Footer />
    </div>
  )
}
