// A hand-placed sketch, not computed: it only shows the idea of parallel offsets.
const POINTS = {
  man: { x: 70, y: 170 },
  woman: { x: 120, y: 70 },
  king: { x: 270, y: 180 },
  queen: { x: 320, y: 80 },
}

function Arrow({ from, to, dashed, colour }) {
  const a = POINTS[from]
  const b = POINTS[to]
  // Stop the line short of the dot so the arrowhead stays visible.
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  return (
    <line
      x1={a.x + ux * 8}
      y1={a.y + uy * 8}
      x2={b.x - ux * 10}
      y2={b.y - uy * 10}
      stroke={colour}
      strokeWidth="2.5"
      strokeDasharray={dashed ? '5 5' : undefined}
      markerEnd={dashed ? 'url(#kq-head-muted)' : 'url(#kq-head)'}
    />
  )
}

export default function KingQueenSketch() {
  return (
    <svg
      viewBox="0 0 400 230"
      role="img"
      aria-label="Sketch: the arrow from man to woman is parallel to the arrow from king to queen, and the arrow from man to king is parallel to the arrow from woman to queen."
    >
      <defs>
        <marker id="kq-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
        <marker id="kq-head-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
        </marker>
      </defs>
      <Arrow from="man" to="king" dashed colour="var(--muted)" />
      <Arrow from="woman" to="queen" dashed colour="var(--muted)" />
      <Arrow from="man" to="woman" colour="var(--accent)" />
      <Arrow from="king" to="queen" colour="var(--accent)" />
      {Object.entries(POINTS).map(([word, p]) => (
        <g key={word}>
          <circle cx={p.x} cy={p.y} r="6" fill="var(--query)" />
          <text x={p.x + 10} y={p.y + (word === 'man' || word === 'king' ? 20 : -10)} fontSize="15">
            {word}
          </text>
        </g>
      ))}
      <text x="200" y="220" fontSize="11" textAnchor="middle" opacity="0.7">
        a sketch, not real data
      </text>
    </svg>
  )
}
