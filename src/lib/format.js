export function formatBytes(n) {
  if (n >= 1e9) return `${Number((n / 1e9).toFixed(2))} GB`
  return `${Math.round(n / 1e6)} MB`
}

export function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} s`
}
