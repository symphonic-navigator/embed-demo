import { angleDegrees, arcPath, pointOnCircle } from '../lib/fan.js'
import { exclusionReason } from '../lib/ranking.js'

const R = 300

export default function AngleFan({ query, results, k, pCount, hoveredId, onHover }) {
  // A quarter circle is enough unless some text points away from the query.
  const maxDeg = results.some((r) => r.similarity < 0) ? 180 : 90
  const ticks = []
  for (let d = 0; d <= maxDeg; d += 15) ticks.push(d)
  const hovered = results.find((r) => r.item.id === hoveredId)
  const left = maxDeg === 180 ? -R - 40 : -40
  const viewBox = `${left} ${-R - 40} ${R + 80 - left} ${R + 75}`

  return (
    <figure className="fan">
      <svg viewBox={viewBox} role="img" aria-label="Each result drawn at its angle to the query">
        <path
          d={`M ${R} 0 A ${R} ${R} 0 0 0 ${pointOnCircle(maxDeg, R).x} ${pointOnCircle(maxDeg, R).y}`}
          fill="none"
          className="fan-circle"
        />
        {ticks.map((d) => {
          const a = pointOnCircle(d, R - 5)
          const b = pointOnCircle(d, R + 5)
          const t = pointOnCircle(d, R + 20)
          return (
            <g key={d}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="fan-tick" />
              <text x={t.x} y={t.y + 4} textAnchor="middle" fontSize="11" className="fan-label">
                {d}°
              </text>
            </g>
          )
        })}
        <line x1="0" y1="0" x2="0" y2={-R} className="fan-ninety" />
        <text x="6" y={-R / 2} fontSize="11" className="fan-label">
          90° = unrelated (cos = 0)
        </text>

        {hovered ? (
          <path d={arcPath(angleDegrees(hovered.similarity), 90)} className="fan-arc" />
        ) : null}

        <line x1="0" y1="0" x2={R} y2="0" className="fan-query" />
        <circle cx={R} cy="0" r="7" className="fan-query-dot" />
        <text x={R} y="22" textAnchor="end" fontSize="12" className="fan-query-label">
          query: “{query.length > 40 ? query.slice(0, 40) + '…' : query}”
        </text>
        <circle cx="0" cy="0" r="3" className="fan-label" />

        {results.map(({ item, similarity }, i) => {
          const deg = angleDegrees(similarity)
          const { x, y } = pointOnCircle(deg, R)
          const out = exclusionReason(i + 1, k, pCount) !== null
          const on = item.id === hoveredId
          return (
            <g key={item.id}>
              {on ? <line x1="0" y1="0" x2={x} y2={y} className="fan-ray" /> : null}
              <circle
                cx={x}
                cy={y}
                r={on ? 10 : 6}
                className={`fan-point${out ? ' out' : ''}${on ? ' on' : ''}`}
                onMouseEnter={() => onHover(item.id)}
                onMouseLeave={() => onHover(null)}
              >
                <title>{item.text}</title>
              </circle>
            </g>
          )
        })}
      </svg>
      <div className="fan-info" aria-live="polite">
        {hovered ? (
          <>
            <b>{hovered.item.text}</b>
            <br />
            Angle to the query: <b>{angleDegrees(hovered.similarity).toFixed(0)}°</b>, so{' '}
            <b>
              cos({angleDegrees(hovered.similarity).toFixed(0)}°) = {hovered.similarity.toFixed(2)} = similarity
            </b>
            .
            <br />
            <span className="muted">Smaller angle: pointing the same way, similar meaning.</span>
          </>
        ) : (
          <span className="muted">Hover over a point or a row in the list.</span>
        )}
      </div>
      <figcaption className="caption">
        Angles to the query are exact; angles between two results are not meaningful.
      </figcaption>
    </figure>
  )
}
