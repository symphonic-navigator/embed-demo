import { cosine } from './vector.js'

// Every text of the collection, best match first. Array.prototype.sort is
// stable, so texts with equal similarity keep their original order.
export function rankBySimilarity(query, items) {
  return items
    .map((item) => ({ item, similarity: cosine(query, item.vector) }))
    .sort((a, b) => b.similarity - a.similarity)
}

// Softmax turns similarities into shares that add up to 1:
//   share_i = exp(s_i / T) / sum_j exp(s_j / T)
// Raw cosines sit close together (say 0.3 to 0.8), so with T = 1 every text
// would get almost the same share. Dividing by a small temperature T stretches
// the differences: low T gives the winner nearly everything, high T flattens.
// Subtracting the maximum first changes nothing mathematically but keeps
// exp() from overflowing.
export function softmax(similarities, temperature) {
  if (similarities.length === 0) return []
  const max = Math.max(...similarities)
  const exps = similarities.map((s) => Math.exp((s - max) / temperature))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

// top-p: admit results in rank order until together they hold at least p of
// the total share. A clear winner fills p alone; a close race admits many.
// The tiny tolerance absorbs rounding (0.7 + 0.1 is 0.7999999999999999).
export function topPCount(probabilities, p) {
  let cumulative = 0
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i]
    if (cumulative >= p - 1e-9) return i + 1
  }
  return probabilities.length
}

// Why a result (1-based rank) is greyed out, or null if it is admitted.
export function exclusionReason(rank, k, pCount) {
  const outK = rank > k
  const outP = rank > pCount
  if (outK && outP) return 'kp'
  if (outK) return 'k'
  if (outP) return 'p'
  return null
}

export const REASON_LABELS = { k: 'k too low', p: 'p too low', kp: 'k and p too low' }
