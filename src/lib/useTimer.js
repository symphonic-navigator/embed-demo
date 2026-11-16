import { useEffect, useState } from 'react'

// Milliseconds since `since` (a performance.now() value), updated ten times a
// second while `since` is set. Running timers show the app is not frozen.
export function useTimer(since) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (since == null) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [since])
  return since == null ? 0 : Math.max(0, now - since)
}
