// The small amount of maths that turns a model's output into one vector per
// text, and compares two vectors.

// The model returns one 2048-number vector per token (seqLen x dim, flattened).
// Mean pooling averages them into one vector for the whole text. The mask says
// which tokens are real (1) and which are padding (0); padding must not count.
export function meanPool(hidden, seqLen, dim, mask) {
  const out = new Float32Array(dim)
  let count = 0
  for (let t = 0; t < seqLen; t++) {
    if (!mask[t]) continue
    count++
    for (let d = 0; d < dim; d++) out[d] += hidden[t * dim + d]
  }
  for (let d = 0; d < dim; d++) out[d] /= count
  return out
}

// Scale a vector to length 1, so that only its direction is left. After this,
// the cosine of two vectors is simply their dot product.
export function l2Normalise(v) {
  let sum = 0
  for (const x of v) sum += x * x
  const norm = Math.sqrt(sum)
  return Float32Array.from(v, (x) => x / norm)
}

// cos(angle) = (a · b) / (|a| |b|): 1 = same direction, 0 = unrelated
// (perpendicular), -1 = opposite.
export function cosine(a, b) {
  let dot = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  return dot / Math.sqrt(aa * bb)
}

// Long texts are cut to their first `max` tokens (see MAX_TOKENS in config.js).
export function truncate(ids, max) {
  return ids.length > max ? ids.slice(0, max) : ids
}
