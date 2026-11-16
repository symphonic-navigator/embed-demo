import { describe, expect, test } from 'vitest'
import { angleDegrees, arcPath, pointOnCircle } from './fan.js'

describe('angleDegrees', () => {
  test('1 is 0°, 0 is 90°, -1 is 180°', () => {
    expect(angleDegrees(1)).toBe(0)
    expect(angleDegrees(0)).toBeCloseTo(90, 9)
    expect(angleDegrees(-1)).toBeCloseTo(180, 9)
  })
  test('cos(34.92°) ≈ 0.82', () => expect(angleDegrees(0.82)).toBeCloseTo(34.92, 2))
  test('rounding slightly above 1 does not give NaN', () => expect(angleDegrees(1.0000001)).toBe(0))
})

describe('pointOnCircle', () => {
  test('0° lies on the x-axis', () => {
    const p = pointOnCircle(0, 400)
    expect(p.x).toBeCloseTo(400, 9)
    expect(p.y).toBeCloseTo(0, 9)
  })
  test('90° points up (negative y in SVG)', () => {
    const p = pointOnCircle(90, 400)
    expect(p.x).toBeCloseTo(0, 9)
    expect(p.y).toBeCloseTo(-400, 9)
  })
})

describe('arcPath', () => {
  test('draws a slice from the x-axis to the angle', () => {
    const d = arcPath(90, 100)
    expect(d.startsWith('M 0 0 L 100 0 A 100 100 0 0 0 ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    const [x, y] = d.split(' ').slice(-3, -1).map(Number)
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(-100, 6)
  })
})
