import { describe, expect, test } from 'vitest'
import { cosine, l2Normalise, meanPool, truncate } from './vector.js'

const close = (actual, expected) => expected.forEach((e, i) => expect(actual[i]).toBeCloseTo(e, 6))

describe('meanPool', () => {
  test('averages only the tokens the mask marks as real', () => {
    const hidden = new Float32Array([1, 2, 3, 4, 100, 100])
    close(meanPool(hidden, 3, 2, [1, 1, 0]), [2, 3])
  })
  test('averages all tokens when the mask is full', () => {
    close(meanPool(new Float32Array([1, 2, 3, 4]), 2, 2, [1, 1]), [2, 3])
  })
})

describe('l2Normalise', () => {
  test('scales a vector to length 1', () => {
    close(l2Normalise(new Float32Array([3, 4])), [0.6, 0.8])
  })
  test('returns a new array', () => {
    const v = new Float32Array([3, 4])
    expect(l2Normalise(v)).not.toBe(v)
    expect(v[0]).toBe(3)
  })
})

describe('cosine', () => {
  test('is 0 for perpendicular vectors', () => expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6))
  test('is 1 for vectors pointing the same way, whatever their length', () =>
    expect(cosine([1, 2], [2, 4])).toBeCloseTo(1, 6))
  test('is -1 for opposite vectors', () => expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 6))
})

describe('truncate', () => {
  test('keeps the first max ids', () => expect(truncate([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2, 3, 4]))
  test('leaves short input unchanged', () => expect(truncate([1, 2], 4)).toEqual([1, 2]))
})
