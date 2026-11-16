import { expect, test } from 'vitest'
import { isPhone } from './device.js'

const media = (matches) => (query) => ({ matches: matches[query] ?? false })

test('a small screen with a coarse pointer is a phone', () => {
  expect(isPhone(media({ '(max-width: 600px)': true, '(pointer: coarse)': true }))).toBe(true)
})
test('a small window with a mouse is not a phone', () => {
  expect(isPhone(media({ '(max-width: 600px)': true, '(pointer: coarse)': false }))).toBe(false)
})
test('a large touch screen (tablet) is not a phone', () => {
  expect(isPhone(media({ '(max-width: 600px)': false, '(pointer: coarse)': true }))).toBe(false)
})
