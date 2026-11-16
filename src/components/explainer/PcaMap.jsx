import map from '../../data/pca-map.json'

const W = 420
const H = 400
const PAD = 30
const LANG_LABEL = { jpn: 'ja', fra: 'fr', deu: 'de', eng: 'en' }
const LANG_NAME = { jpn: 'Japanese', fra: 'French', deu: 'German', eng: 'English' }
const SHAPES = ['circle', 'square', 'triangle', 'diamond']

const groups = [...new Set(map.points.map((p) => p.group))]
const styleOf = (group) => {
  const i = groups.indexOf(group)
  return { shape: SHAPES[i % SHAPES.length], colour: `var(--group-${(i % 4) + 1})` }
}

// One scale for both axes, so the picture is not stretched in either direction.
const xs = map.points.map((p) => p.x)
const ys = map.points.map((p) => p.y)
const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY))
const offX = (W - scale * (maxX - minX)) / 2
const offY = (H - scale * (maxY - minY)) / 2
const toX = (x) => offX + (x - minX) * scale
const toY = (y) => H - offY - (y - minY) * scale

function Marker({ shape, colour, x, y, size = 6 }) {
  if (shape === 'square') return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} fill={colour} />
  if (shape === 'triangle') {
    return <path d={`M${x},${y - size * 1.2} L${x + size * 1.1},${y + size * 0.8} L${x - size * 1.1},${y + size * 0.8} z`} fill={colour} />
  }
  if (shape === 'diamond') {
    return <path d={`M${x},${y - size * 1.3} L${x + size * 1.1},${y} L${x},${y + size * 1.3} L${x - size * 1.1},${y} z`} fill={colour} />
  }
  return <circle cx={x} cy={y} r={size} fill={colour} />
}

export default function PcaMap() {
  const percent = Math.round(map.explainedVariance * 100)
  return (
    <div className="figure">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Map of ${map.points.length} sentences in four languages. They form ${groups.length} clusters, one per meaning: ${groups.join(', ')}.`}
      >
        <rect x="1" y="1" width={W - 2} height={H - 2} fill="none" stroke="var(--line)" rx="6" />
        {map.points.map((p) => {
          const { shape, colour } = styleOf(p.group)
          const x = toX(p.x)
          const y = toY(p.y)
          return (
            <g key={`${p.group}-${p.lang}`}>
              <title>{`${p.text} (${LANG_NAME[p.lang]}, “${p.group}”)`}</title>
              <Marker shape={shape} colour={colour} x={x} y={y} />
              <text x={x + 9} y={y + 4} fontSize="11" className="pca-lang">
                {LANG_LABEL[p.lang]}
              </text>
            </g>
          )
        })}
      </svg>
      <ul className="pca-legend">
        {groups.map((g) => {
          const { shape, colour } = styleOf(g)
          return (
            <li key={g}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <Marker shape={shape} colour={colour} x={8} y={8} size={5} />
              </svg>
              {g}
            </li>
          )
        })}
      </ul>
      <p className="caption">
        A flattened view, distances are approximate. The two axes keep only about {percent} % of the variation in
        the 2048 dimensions, but even so the texts cluster by meaning, not by language.
      </p>
    </div>
  )
}
