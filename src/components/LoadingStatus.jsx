import { MODEL_LABEL } from '../config.js'
import { formatBytes, formatSeconds } from '../lib/format.js'
import { useTimer } from '../lib/useTimer.js'

export default function LoadingStatus({ model, opened, onOpen }) {
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
          className={opened ? 'primary' : 'primary pulse'}
          onClick={onOpen}
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
              : model.total && model.loaded <= model.total
                ? `${formatBytes(model.loaded)} of ${formatBytes(model.total)}`
                : formatBytes(model.loaded)}
          </span>
        </>
      )}
    </div>
  )
}
