// Geometry of the angle fan. Any two vectors, however many dimensions they
// have, span a flat plane, and inside that plane the angle between them is
// exactly arccos(similarity). So each result can be drawn at its true angle to
// the query. Angles *between two results* are not preserved, because each
// result lives in a different plane with the query.

// Similarity → angle in degrees. Clamped because rounding can give 1.0000001.
export function angleDegrees(similarity) {
  const s = Math.min(1, Math.max(-1, similarity))
  return (Math.acos(s) * 180) / Math.PI
}

// SVG y grows downwards, so y is negated to let angles open upwards.
export function pointOnCircle(degrees, radius) {
  const rad = (degrees * Math.PI) / 180
  return { x: radius * Math.cos(rad), y: -radius * Math.sin(rad) }
}

// A pie slice from the query direction (x-axis) to the given angle.
export function arcPath(degrees, radius) {
  const { x, y } = pointOnCircle(degrees, radius)
  return `M 0 0 L ${radius} 0 A ${radius} ${radius} 0 0 0 ${x} ${y} Z`
}
