import { describe, expect, test } from 'vitest'
import demoSet from './demo-set.json'
import suggestionVectors from './suggestion-vectors.json'
import { DEFAULTS, DEMO_SUGGESTIONS, SLIDERS } from './suggestions.js'
import { exclusionReason, rankBySimilarity, softmax, topPCount } from '../lib/ranking.js'

const first = suggestionVectors.queries[0]
const ranked = rankBySimilarity(first.vector, demoSet.items)
const pCountAt = (temperature) => topPCount(softmax(ranked.map((r) => r.similarity), temperature), DEFAULTS.p)

describe('demo data', () => {
  test('suggestion vectors and demo set come from the same model', () => {
    expect(suggestionVectors.sha256).toBe(demoSet.model.sha256)
    expect(suggestionVectors.queries.map((q) => q.text)).toEqual(DEMO_SUGGESTIONS)
  })
  test('about 40 sentences, mostly Japanese, 2048 dimensions each', () => {
    expect(demoSet.items.length).toBeGreaterThanOrEqual(35)
    const ja = demoSet.items.filter((i) => i.lang === 'jpn').length
    expect(ja / demoSet.items.length).toBeGreaterThan(0.5)
    expect(demoSet.items.every((i) => i.vector.length === 2048)).toBe(true)
  })
})

describe('DEFAULTS with the first suggestion chip (spec §7 step 4)', () => {
  test('a sleeping cat comes first', () => {
    expect(first.text).toBe('un chat qui dort')
    expect(ranked[0].item.text).toMatch(/猫/)
  })
  test('the p line sits above the k line', () => {
    expect(pCountAt(DEFAULTS.temperature)).toBeLessThan(DEFAULTS.k)
  })
  test('at least one row carries only "p too low"', () => {
    const pCount = pCountAt(DEFAULTS.temperature)
    const reasons = ranked.map((_, i) => exclusionReason(i + 1, DEFAULTS.k, pCount))
    expect(reasons).toContain('p')
  })
  test('raising the temperature to the slider maximum moves the p line below the k line (step 5)', () => {
    expect(pCountAt(SLIDERS.temperature.max)).toBeGreaterThanOrEqual(DEFAULTS.k)
  })
})
