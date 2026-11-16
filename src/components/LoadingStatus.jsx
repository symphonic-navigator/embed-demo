import { useState } from 'react'
import { MODEL_LABEL } from '../config.js'
import { formatBytes, formatSeconds } from '../lib/format.js'
import { useTimer } from '../lib/useTimer.js'

export default function LoadingStatus({ model, onOpen }) {
  const [clicked, setClicked] = useState(false)
  const preparing = useTimer(model.phase === 'preparing' ? model.preparingSince : null)

  if (model.phase === 'error') {
    return (
      <div className="status-bar error" role="alert">
        <p>
          The embedding model could not be loaded: {model.error} The Explainer still works; try reloading the page
          later.
        </p>
      </div>
    )
  }
  if (model.phase === 'ready') {
    return (
      <div className="status-bar">
        <button
          className={clicked ? 'primary' : 'primary pulse'}
          onClick={() => {
            setClicked(true)
            onOpen()
          }}
        >
          You can explore vector embeddings now
        </button>
      </div>
    )
  }
  return (
    <div className="status-bar" aria-live="polite">
      <p>Loading the embedding model {MODEL_LABEL} — have a look around…</p>
      {model.phase === 'preparing' ? (
        <p className="muted">Download complete. Preparing the model… {formatSeconds(preparing)}</p>
      ) : (
        <>
          <progress max={model.total || undefined} value={model.total ? model.loaded : undefined} />
          <span className="muted">
            {model.phase === 'idle'
              ? 'Starting…'
              : model.total
                ? `${formatBytes(model.loaded)} of ${formatBytes(model.total)}`
                : formatBytes(model.loaded)}
          </span>
        </>
      )}
    </div>
  )
}
