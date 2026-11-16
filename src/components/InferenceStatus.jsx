import { formatSeconds } from '../lib/format.js'
import { useTimer } from '../lib/useTimer.js'
import { BACKEND_LABELS } from './labels.js'

// While the model works: what it is doing, a running timer and the backend,
// so slow hardware never looks frozen.
export default function InferenceStatus({ busy, last, backend }) {
  const elapsed = useTimer(busy?.since ?? null)
  const where = BACKEND_LABELS[backend] ?? backend
  if (busy) {
    const what =
      busy.total > 1 ? `Embedding ${Math.min(busy.done + 1, busy.total)} of ${busy.total}…` : `${busy.label}…`
    return (
      <p className="inference busy" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> {what} {formatSeconds(elapsed)} ({where})
      </p>
    )
  }
  return (
    <p className="inference muted">
      {last ? `${last.label} took ${formatSeconds(last.ms)} on ${where}. ` : `The model runs on ${where}. `}
      {backend === 'wasm' ? 'On the CPU each text takes a few seconds; be patient.' : ''}
    </p>
  )
}
