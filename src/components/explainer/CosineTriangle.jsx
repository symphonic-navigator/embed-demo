import { useId, useState } from 'react'

const OX = 100 // the corner with the angle
const OY = 220
const R = 190 // the hypotenuse: a vector of length 1, drawn 190 units long

function polar(radius, deg) {
  const t = (deg * Math.PI) / 180
  return { x: OX + radius * Math.cos(t), y: OY - radius * Math.sin(t) }
}

// An arc around the corner, from angle a to angle b (degrees, counter-clockwise on screen).
function arc(radius, a, b) {
  const p = polar(radius, a)
  const q = polar(radius, b)
  return `M${p.x},${p.y} A${radius},${radius} 0 0 0 ${q.x},${q.y}`
}

export default function CosineTriangle() {
  const [deg, setDeg] = useState(60)
  const sliderId = useId()
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const tip = polar(R, deg)
  const foot = { x: tip.x, y: OY }
  const showSquare = foot.x - OX > 14 && OY - tip.y > 14

  return (
    <div className="figure">
      <svg
        viewBox="0 0 360 250"
        role="img"
        aria-label={`Right-angled triangle with an angle of ${deg} degrees. The hypotenuse has length 1, the adjacent side has length ${cos.toFixed(2)}, which is the cosine.`}
      >
        {/* The quarter of the unit circle the tip moves along, and the band where real results land. */}
        <path d={arc(R, 0, 90)} fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <path d={arc(R, 60, 85)} fill="none" stroke="var(--p)" strokeWidth="6" opacity="0.35" />
        <text x={polar(R + 10, 62).x} y={polar(R + 10, 62).y} fontSize="10" opacity="0.8">
          where most real results land
        </text>

        <line x1={tip.x} y1={tip.y} x2={foot.x} y2={foot.y} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" />
        <line x1={OX} y1={OY} x2={foot.x} y2={foot.y} stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
        <line x1={OX} y1={OY} x2={tip.x} y2={tip.y} stroke="currentColor" strokeWidth="2.5" />
        {showSquare ? (
          <path
            d={`M${foot.x - 10},${OY} L${foot.x - 10},${OY - 10} L${foot.x},${OY - 10}`}
            fill="none"
            stroke="var(--muted)"
          />
        ) : null}
        <path d={arc(32, 0, deg)} fill="none" stroke="var(--query)" strokeWidth="2" />
        <circle cx={tip.x} cy={tip.y} r="4" fill="var(--query)" />

        <text x={polar(44, deg / 2).x} y={polar(44, deg / 2).y + 4} fontSize="12">
          {deg}°
        </text>
        <text
          x={polar(R / 2, deg).x - 14 * Math.sin(rad)}
          y={polar(R / 2, deg).y - 14 * Math.cos(rad)}
          fontSize="12"
          textAnchor={deg > 30 ? 'end' : 'middle'}
        >
          hypotenuse = 1
        </text>
        <text x={OX + (foot.x - OX) / 2} y={OY + 22} fontSize="12" textAnchor="middle">
          adjacent = {cos.toFixed(2)}
        </text>
      </svg>

      <label htmlFor={sliderId} className="cosine-control">
        Angle: {deg}°
        <input id={sliderId} type="range" min="0" max="90" step="1" value={deg} onChange={(e) => setDeg(Number(e.target.value))} />
      </label>
      <p className="cosine-readout" aria-live="polite">
        cos({deg}°) = adjacent ÷ hypotenuse = {cos.toFixed(2)} ÷ 1 = <strong>{cos.toFixed(2)}</strong>
        {deg === 90 ? ' (unrelated)' : deg === 0 ? ' (the same direction)' : ''}
      </p>
    </div>
  )
}
