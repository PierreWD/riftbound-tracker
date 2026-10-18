import { useMemo } from 'react'
import { useStore } from '../../data/store'
import { deckLabel, gameScore, nameOf, sortMatchesDesc } from '../../data/matchUtils'
import { goBack, navigate } from '../../router'
import { applyFilters } from '../../stats/filters'
import { averageMargin, breakdown, gameRows, matchRows, pct, record, tagCounts, tallyRows } from '../../stats/engine'
import { getDimension } from '../../stats/dimensions'
import { FilterBar } from '../../components/FilterBar'
import { ResultBadge, StatTable, StatTile, toneOf } from '../../components/stats'
import { Empty } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { GamePips } from '../MatchList'

export function MatchupDetail({ legendId }: { legendId: string }) {
  const { data, filters } = useStore()
  const matches = useMemo(
    () => applyFilters(data.matches, filters).filter((m) => m.opponent.legendId === legendId),
    [data.matches, filters, legendId],
  )
  const legend = nameOf(data.legends, legendId)
  const d = (id: string) => getDimension(data, id)
  const mRows = matchRows(matches)
  const gRows = gameRows(matches)
  const mt = tallyRows(mRows)
  const gt = tallyRows(gRows)
  const margin = averageMargin(gRows)
  const lostMargin = averageMargin(gRows.filter((r) => r.game!.result === 'L'))
  const tags = [...tagCounts(matches).entries()]
    .map(([id, c]) => ({ name: nameOf(data.reasonTags, id), ...c }))
    .sort((a, b) => b.inLosses + b.inWins - (a.inLosses + a.inWins))
  const withNotes = sortMatchesDesc(matches)

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('analysis/matchups')} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>vs {legend}</h1>
      </header>
      <FilterBar count={matches.length} />
      {!matches.length ? (
        <Empty title={`Aucun match contre ${legend}`} />
      ) : (
        <>
          <div className="tiles">
            <StatTile label="Matchs" value={pct(mt.winrate)} tone={toneOf(mt)} sub={record(mt)} />
            <StatTile label="Games" value={pct(gt.winrate)} tone={toneOf(gt)} sub={record(gt)} />
            <StatTile
              label="Écart moyen"
              value={margin.avg == null ? '—' : `${margin.avg > 0 ? '+' : ''}${margin.avg.toFixed(1).replace('.', ',')}`}
              sub="points par game"
            />
            <StatTile
              label="Défaites"
              value={lostMargin.avg == null ? '—' : `−${Math.abs(lostMargin.avg).toFixed(1).replace('.', ',')}`}
              sub="écart moyen quand je perds"
            />
          </div>

          <section className="card">
            <h2>Premier ou second</h2>
            <StatTable rows={breakdown(gRows, d('wentFirst'))} unit="game" />
          </section>
          <section className="card">
            <h2>G1 vs après side</h2>
            <StatTable rows={breakdown(gRows, d('gameIndex'))} unit="game" />
          </section>
          <section className="card">
            <h2>Avec quel deck</h2>
            <StatTable rows={breakdown(mRows, d('myDeck'))} unit="match" />
          </section>
          <section className="card">
            <h2>Ses versions de deck</h2>
            <StatTable rows={breakdown(mRows, { ...d('oppLegend'), id: 'oppDeck', keys: (r) => (r.match.opponent.deckName ? [r.match.opponent.deckName.trim()] : []), labelOf: (k) => k })} unit="match" />
          </section>
          <section className="card">
            <h2>Battlefields</h2>
            <h3 className="sub">Le mien</h3>
            <StatTable rows={breakdown(gRows, d('myBattlefield'))} unit="game" />
            <h3 className="sub">Le sien</h3>
            <StatTable rows={breakdown(gRows, d('oppBattlefield'))} unit="game" />
          </section>
          <section className="card">
            <h2>Raisons</h2>
            {tags.length ? (
              <ul className="kv-list">
                {tags.map((t) => (
                  <li key={t.name} className="kv">
                    <span>{t.name}</span>
                    <span>
                      <span className="tone-bad">{t.inLosses} déf.</span> · <span className="tone-good">{t.inWins} vict.</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Aucun tag saisi sur ce match-up.</p>
            )}
          </section>

          <section className="card">
            <h2>Tous les matchs et notes</h2>
            <ul className="notes-list">
              {withNotes.map((m) => (
                <li key={m.id}>
                  <button className="plain note-item" onClick={() => navigate(`match/${m.id}`)}>
                    <span className="note-head">
                      <ResultBadge result={m.result} />
                      <strong>{gameScore(m)}</strong>
                      <GamePips match={m} />
                      <span className="muted small">
                        {m.date} · {deckLabel(data, m.myDeckId)}
                        {m.opponent.deckName ? ` vs ${m.opponent.deckName}` : ''}
                      </span>
                    </span>
                    {m.opponent.comment && <span className="muted">Son deck : {m.opponent.comment}</span>}
                    {m.comment && <span>{m.comment}</span>}
                    {m.games
                      .filter((g) => g.note)
                      .map((g) => (
                        <span key={g.index} className="muted">
                          G{g.index} : {g.note}
                        </span>
                      ))}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
