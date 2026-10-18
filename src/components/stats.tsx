import type { ReactNode } from 'react'
import { pct, record, SMALL_SAMPLE, type BreakdownRow, type Tally } from '../stats/engine'
import { Icon } from './Icon'

/** Ton (bon / mauvais / neutre) d'un winrate, pour la couleur. */
export function toneOf(t: Pick<Tally, 'winrate' | 'n'>): 'good' | 'bad' | 'neutral' {
  if (t.winrate == null) return 'neutral'
  if (t.winrate >= 0.55) return 'good'
  if (t.winrate <= 0.45) return 'bad'
  return 'neutral'
}

/** Barre de winrate : remplissage + repère à 50 % + intervalle de confiance en fond. */
export function WinrateBar({ t }: { t: Tally }) {
  if (t.winrate == null) return <div className="wr-bar empty" />
  return (
    <div className="wr-bar" title={`Intervalle probable : ${pct(t.low)} – ${pct(t.high)}`}>
      <div className="wr-ci" style={{ left: `${t.low * 100}%`, width: `${(t.high - t.low) * 100}%` }} />
      <div className={`wr-fill ${toneOf(t)}`} style={{ width: `${Math.max(t.winrate * 100, 1.5)}%` }} />
      <div className="wr-mid" />
    </div>
  )
}

export function SampleBadge({ n }: { n: number }) {
  if (n >= SMALL_SAMPLE) return null
  return (
    <span className="badge small-sample" title="Moins de 5 résultats : à prendre avec prudence">
      peu de données
    </span>
  )
}

export function WinratePill({ t }: { t: Tally }) {
  return <span className={`wr-pill ${toneOf(t)}`}>{pct(t.winrate)}</span>
}

/** Tableau de stats : une ligne par valeur (légende, deck, battlefield…). */
export function StatTable({
  rows,
  unit,
  onRowClick,
  extra,
  emptyText = 'Pas encore de données.',
}: {
  rows: BreakdownRow[]
  unit: 'match' | 'game'
  onRowClick?(row: BreakdownRow): void
  extra?(row: BreakdownRow): ReactNode
  emptyText?: string
}) {
  if (!rows.length) return <p className="muted">{emptyText}</p>
  return (
    <ul className="stat-table">
      {rows.map((r) => {
        const content = (
          <>
            <div className="st-top">
              <span className="st-label">{r.label}</span>
              <span className="st-record">
                {record(r)} <small>{unit === 'match' ? 'matchs' : 'games'}</small>
              </span>
              <WinratePill t={r} />
              {onRowClick && <Icon name="chevron" size={16} />}
            </div>
            <WinrateBar t={r} />
            {(extra || r.n < SMALL_SAMPLE) && (
              <div className="st-extra">
                {extra?.(r)}
                <SampleBadge n={r.n} />
              </div>
            )}
          </>
        )
        return (
          <li key={r.key}>
            {onRowClick ? (
              <button className="st-row clickable" onClick={() => onRowClick(r)}>
                {content}
              </button>
            ) : (
              <div className="st-row">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className={`tile-value ${tone ?? ''}`}>{value}</span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  )
}

export function ResultBadge({ result }: { result: 'W' | 'L' | 'D' }) {
  const label = { W: 'V', L: 'D', D: 'N' }[result]
  const full = { W: 'Victoire', L: 'Défaite', D: 'Nul' }[result]
  return (
    <span className={`result-badge r-${result}`} aria-label={full} title={full}>
      {label}
    </span>
  )
}
