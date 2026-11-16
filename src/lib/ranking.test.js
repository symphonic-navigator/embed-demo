import { describe, expect, test } from 'vitest'
import { REASON_LABELS, exclusionReason, rankBySimilarity, softmax, topPCount } from './ranking.js'

describe('softmax', () => {
  const sims = [0.82, 0.71, 0.63, 0.52]
  test('sums to 1', () => {
    expect(softmax(sims, 0.08).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
  })
  test('keeps the order of the similarities', () => {
    const p = softmax(sims, 0.08)
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeLessThan(p[i - 1])
  })
  test('a higher temperature flattens the shares', () => {
    expect(softmax(sims, 0.08)[0]).toBeGreaterThan(softmax(sims, 0.5)[0])
  })
  test('does not overflow for large inputs', () => {
    const p = softmax([1000, 999], 1)
    expect(p.every(Number.isFinite)).toBe(true)
    expect(p[0]).toBeCloseTo(1 / (1 + Math.exp(-1)), 9)
  })
  test('is empty for no input', () => expect(softmax([], 0.1)).toEqual([]))
})

describe('topPCount', () => {
  test('admits results until together they reach p', () => {
    expect(topPCount([0.5, 0.3, 0.2], 0.8)).toBe(2)
    expect(topPCount([0.5, 0.3, 0.2], 0.81)).toBe(3)
  })
  test('p = 1 admits everything', () => expect(topPCount([0.5, 0.3, 0.2], 1)).toBe(3))
  test('tolerates floating-point sums just below p', () => {
    // 0.7 + 0.1 is 0.7999999999999999 in floating point
    expect(topPCount([0.7, 0.1, 0.2], 0.8)).toBe(2)
  })
  test('ties: equal shares need half the items for p = 0.5', () =>
    expect(topPCount([0.25, 0.25, 0.25, 0.25], 0.5)).toBe(2))
  test('is 0 for an empty list and at least 1 otherwise', () => {
    expect(topPCount([], 0.8)).toBe(0)
    expect(topPCount([0.9, 0.1], 0.01)).toBe(1)
  })
  test('matches the validated mock-up', () => {
    const p = softmax([0.82, 0.71, 0.63, 0.52, 0.38, 0.29, 0.21, 0.18], 0.08)
    expect(topPCount(p, 0.8)).toBe(2)
  })
})

describe('exclusionReason', () => {
  test('null when inside both limits', () => expect(exclusionReason(3, 4, 3)).toBeNull())
  test("'p' when only p is too low", () => expect(exclusionReason(4, 4, 3)).toBe('p'))
  test("'k' when only k is too low", () => expect(exclusionReason(3, 2, 5)).toBe('k'))
  test("'kp' when both are too low", () => expect(exclusionReason(5, 4, 3)).toBe('kp'))
  test('labels', () => {
    expect(REASON_LABELS).toEqual({ k: 'k too low', p: 'p too low', kp: 'k and p too low' })
  })
})

describe('rankBySimilarity', () => {
  const items = [
    { id: 'a', vector: [0, 1] },
    { id: 'b', vector: [1, 0] },
    { id: 'c', vector: [1, 1] },
    { id: 'd', vector: [0, 2] },
  ]
  test('sorts by cosine, best first, and keeps insertion order for ties', () => {
    const ranked = rankBySimilarity([1, 0.1], items)
    expect(ranked.map((r) => r.item.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(ranked[0].similarity).toBeCloseTo(1 / Math.hypot(1, 0.1), 9)
  })
  test('empty collection gives an empty list', () => expect(rankBySimilarity([1, 0], [])).toEqual([]))
})
