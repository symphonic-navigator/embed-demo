import { expect, test } from 'vitest'
import { formatBytes, formatSeconds } from './format.js'

test('formatBytes uses decimal units like download dialogs', () => {
  expect(formatBytes(412e6)).toBe('412 MB')
  expect(formatBytes(1.2e9)).toBe('1.2 GB')
  expect(formatBytes(1_252_692_075)).toBe('1.25 GB')
  expect(formatBytes(412_345_678)).toBe('412 MB')
  expect(formatBytes(0)).toBe('0 MB')
})
test('formatSeconds shows one decimal', () => {
  expect(formatSeconds(2400)).toBe('2.4 s')
  expect(formatSeconds(0)).toBe('0.0 s')
})
