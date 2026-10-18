import { useMemo } from 'react'
import type { Match } from '../data/schema'
import { useStore } from '../data/store'
import { deckLabel, gameScore, nameOf, sortMatchesDesc } from '../data/matchUtils'
import { navigate } from '../router'
import { tally, record } from '../stats/engine'
import { ImportExportButtons, daysSince } from '../components/ImportExport'
import { ResultBadge } from '../components/stats'
import { Empty } from '../components/ui'
import { Icon } from '../components/Icon'

interface Group {
  key: string
  date: string
  title: string
  matches: Match[]
}

export function formatDay(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function GamePips({ match }: { match: Match }) {
  return (
    <span className="pips">
      {match.games.map((g) => (
        <span
          key={g.index}
          className={`pip r-${g.result}`}
          title={`G${g.index} : ${g.result === 'W' ? 'victoire' : g.result === 'L' ? 'défaite' : 'nul'}${g.iWentFirst == null ? '' : g.iWentFirst ? ', je commence' : ', second'}`}
        >
          {g.iWentFirst == null ? '·' : g.iWentFirst ? '1' : '2'}
        </span>
      ))}
    </span>
  )
}

export function MatchList() {
  const { data } = useStore()
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = []
    for (const m of sortMatchesDesc(data.matches)) {
      const key = `${m.date}|${m.tournamentTypeId}|${m.tournamentName ?? ''}`
      let g = out.find((x) => x.key === key)
      if (!g) {
        const type = nameOf(data.tournamentTypes, m.tournamentTypeId)
        g = { key, date: m.date, title: m.tournamentName ? `${type} · ${m.tournamentName}` : type, matches: [] }
        out.push(g)
      }
      g.matches.push(m)
    }
    return out
  }, [data])

  const since = daysSince(data.meta.lastExportAt)
  const needsBackup = data.matches.length >= 3 && (since == null || since > 14)

  return (
    <div className="screen">
      <header className="top-bar">
        <h1>Mes matchs</h1>
        <ImportExportButtons compact />
      </header>

      {needsBackup && (
        <div className="banner warn">
          {since == null ? 'Tu n’as jamais exporté de sauvegarde.' : `Dernière sauvegarde il y a ${since} jours.`} Tes données ne
          sont que sur ce téléphone : pense à exporter (bouton ↑ en haut).
        </div>
      )}

      {!data.matches.length ? (
        <Empty title="Aucun match pour l’instant">
          <p className="muted">Ajoute ton premier match de tournoi, ou charge des données d’exemple dans les Réglages pour découvrir les stats.</p>
          <button className="btn primary" onClick={() => navigate('new')}>
            <Icon name="plus" size={18} /> Ajouter un match
          </button>
        </Empty>
      ) : (
        groups.map((g) => {
          const t = tally(g.matches.map((m) => m.result))
          return (
            <section key={g.key} className="group">
              <div className="group-head">
                <span>
                  <strong>{g.title}</strong>
                  <span className="muted small"> · {formatDay(g.date)}</span>
                </span>
                <span className="group-record">{record(t)}</span>
              </div>
              <ul className="match-list">
                {g.matches.map((m) => (
                  <li key={m.id}>
                    <button className="match-row" onClick={() => navigate(`match/${m.id}`)}>
                      <ResultBadge result={m.result} />
                      <span className="mr-main">
                        <span className="mr-title">
                          vs {nameOf(data.legends, m.opponent.legendId)}
                          {m.opponent.deckName && <span className="muted"> · {m.opponent.deckName}</span>}
                        </span>
                        <span className="mr-sub">
                          {m.round ? `R${m.round} · ` : ''}
                          {deckLabel(data, m.myDeckId)}
                          {m.opponent.name ? ` · ${m.opponent.name}` : ''}
                        </span>
                      </span>
                      <span className="mr-score">
                        <strong>{gameScore(m)}</strong>
                        <GamePips match={m} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
