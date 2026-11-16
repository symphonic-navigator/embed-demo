import { Fragment } from 'react'
import { REASON_LABELS, exclusionReason } from '../lib/ranking.js'
import { LANG_NAMES } from './labels.js'

function Boundary({ kind, children }) {
  return (
    <div className={`boundary ${kind}`} role="separator">
      <span>{children}</span>
    </div>
  )
}

function Source({ item }) {
  if (!Number.isInteger(item.sourceId)) return null
  return (
    <a className="source" href={`https://tatoeba.org/en/sentences/show/${item.sourceId}`} target="_blank" rel="noreferrer">
      Tatoeba #{item.sourceId}
    </a>
  )
}

export default function ResultsList({ results, probabilities, k, p, pCount, hoveredId, onHover, translationOf }) {
  return (
    <ol className="results" onMouseLeave={() => onHover(null)}>
      {results.map(({ item, similarity }, i) => {
        const rank = i + 1
        const reason = exclusionReason(rank, k, pCount)
        const share = probabilities[i]
        const original = translationOf(item)
        return (
          <Fragment key={item.id}>
            <li
              className={`row${reason ? ' out' : ''}${hoveredId === item.id ? ' on' : ''}`}
              onMouseEnter={() => onHover(item.id)}
              onFocus={() => onHover(item.id)}
              tabIndex={0}
              data-rank={rank}
            >
              <span className="rank">{rank}</span>
              <div className="text">
                <span lang={item.lang?.slice(0, 2)}>{item.text}</span>
                {reason ? <span className={`badge ${reason}`}>{REASON_LABELS[reason]}</span> : null}
                <div className="meta">
                  {LANG_NAMES[item.lang] ?? item.lang ?? ''}
                  {original ? ` · translation of “${original.text}”` : ''} <Source item={item} />
                </div>
              </div>
              <div className="bars">
                <span>similarity {similarity.toFixed(2)}</span>
                <div className="bar sim">
                  <span style={{ width: `${Math.max(0, similarity) * 100}%` }} />
                </div>
                <span>share {(share * 100).toFixed(1)} %</span>
                <div className="bar share">
                  <span style={{ width: `${share * 100}%` }} />
                </div>
              </div>
            </li>
            {rank === k && rank === pCount ? (
              <Boundary kind="both">k line (k = {k}) and p line (p = {p.toFixed(2)})</Boundary>
            ) : rank === k ? (
              <Boundary kind="k">k line (k = {k})</Boundary>
            ) : rank === pCount ? (
              <Boundary kind="p">p line (p = {p.toFixed(2)})</Boundary>
            ) : null}
          </Fragment>
        )
      })}
    </ol>
  )
}
