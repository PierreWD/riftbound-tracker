import { lazy, Suspense, useMemo, useState } from 'react'
import type { AppData, Match } from '../../data/schema'
import { useStore } from '../../data/store'
import { sortMatchesAsc, sortMatchesDesc } from '../../data/matchUtils'
import { navigate } from '../../router'
import {
  averageMargin,
  breakdown,
  gameRows,
  matchRows,
  pct,
  record,
  rollingWinrate,
  tagCounts,
  tallyRows,
  type BreakdownRow,
  type Dimension,
} from '../../stats/engine'
import { buildDimensions, getDimension } from '../../stats/dimensions'
import { applyFilters } from '../../stats/filters'
import { computeInsights } from '../../stats/insights'
import { FilterBar } from '../../components/FilterBar'
import { ResultBadge, StatTable, StatTile, WinratePill, toneOf } from '../../components/stats'
// Chargé à la demande : la librairie de graphiques est lourde
const TrendChart = lazy(() => import('../../components/TrendChart'))
import { Empty, Segmented } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ImportExportButtons } from '../../components/ImportExport'

const TABS = [
  ['overview', 'Résumé'],
  ['matchups', 'Match-ups'],
  ['factors', 'Facteurs'],
  ['reasons', 'Raisons'],
  ['decks', 'Decks & tournois'],
  ['explore', 'Explorer'],
] as const
type Tab = (typeof TABS)[number][0]

export function Analysis({ tab }: { tab?: string }) {
  const { data, filters } = useStore()
  const current: Tab = (TABS.find(([id]) => id === tab)?.[0] ?? 'overview') as Tab
  const matches = useMemo(() => applyFilters(data.matches, filters), [data.matches, filters])

  return (
    <div className="screen">
      <header className="top-bar">
        <h1>Analyse</h1>
        <ImportExportButtons compact />
      </header>
      <FilterBar count={matches.length} />
      <nav className="tabs" aria-label="Sections d'analyse">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab ${id === current ? 'on' : ''}`} onClick={() => navigate(`analysis/${id}`, true)}>
            {label}
          </button>
        ))}
      </nav>
      {!matches.length ? (
        <Empty title="Aucun match à analyser">
          <p className="muted">Ajoute des matchs ou élargis les filtres.</p>
        </Empty>
      ) : (
        <>
          {current === 'overview' && <Overview data={data} matches={matches} />}
          {current === 'matchups' && <Matchups data={data} matches={matches} />}
          {current === 'factors' && <Factors data={data} matches={matches} />}
          {current === 'reasons' && <Reasons data={data} matches={matches} />}
          {current === 'decks' && <DecksTab data={data} matches={matches} />}
          {current === 'explore' && <Explore data={data} matches={matches} />}
        </>
      )}
    </div>
  )
}

interface ViewProps {
  data: AppData
  matches: Match[]
}

function Overview({ data, matches }: ViewProps) {
  const m = tallyRows(matchRows(matches))
  const games = gameRows(matches)
  const g = tallyRows(games)
  const first = tallyRows(games.filter((r) => r.game!.iWentFirst === true))
  const second = tallyRows(games.filter((r) => r.game!.iWentFirst === false))
  const insights = useMemo(() => computeInsights(data, matches), [data, matches])
  const recent = sortMatchesDesc(matches).slice(0, 10)
  return (
    <>
      <div className="tiles">
        <StatTile label="Matchs" value={pct(m.winrate)} tone={toneOf(m)} sub={record(m)} />
        <StatTile label="Games" value={pct(g.winrate)} tone={toneOf(g)} sub={record(g)} />
        <StatTile label="Je commence" value={pct(first.winrate)} tone={toneOf(first)} sub={`${record(first)} games`} />
        <StatTile label="Je suis second" value={pct(second.winrate)} tone={toneOf(second)} sub={`${record(second)} games`} />
      </div>

      <section className="card">
        <h2>Ce qu’il faut retenir</h2>
        <ul className="insights">
          {insights.map((i, k) => (
            <li key={k} className={`insight ${i.tone}`}>
              <span className="insight-icon" aria-hidden="true">
                {i.tone === 'good' ? '▲' : i.tone === 'bad' ? '▼' : '●'}
              </span>
              <span className="insight-text">{i.text}</span>
              {i.legendId && (
                <button className="icon-btn sm" onClick={() => navigate(`matchup/${i.legendId}`)} aria-label="Voir le match-up">
                  <Icon name="chevron" size={16} />
                </button>
              )}
            </li>
          ))}
          {!insights.length && <li className="muted">Pas de tendance marquante pour l’instant. Continue de saisir tes matchs.</li>}
        </ul>
        <p className="muted small">Les constats demandent un minimum de matchs ; plus tu en saisis, plus ils sont fiables.</p>
      </section>

      <section className="card">
        <h2>Évolution du winrate</h2>
        <Suspense fallback={<p className="muted small">Chargement du graphique…</p>}>
          <TrendChart points={rollingWinrate(sortMatchesAsc(matches))} />
        </Suspense>
      </section>

      <section className="card">
        <h2>Forme récente</h2>
        <div className="form-strip">
          {recent.map((x) => (
            <button key={x.id} className="plain" onClick={() => navigate(`match/${x.id}`)} aria-label="Voir le match">
              <ResultBadge result={x.result} />
            </button>
          ))}
        </div>
        <p className="muted small">Du plus récent (à gauche) au plus ancien.</p>
      </section>
    </>
  )
}

function Matchups({ data, matches }: ViewProps) {
  const [unit, setUnit] = useState<'match' | 'game'>('match')
  const [sort, setSort] = useState<'n' | 'worst' | 'best'>('n')
  const dim = getDimension(data, 'oppLegend')
  const rowsBase = breakdown(unit === 'match' ? matchRows(matches) : gameRows(matches), dim)
  const rows = [...rowsBase].sort((a, b) =>
    sort === 'n' ? 0 : sort === 'worst' ? (a.winrate ?? 0) - (b.winrate ?? 0) : (b.winrate ?? 0) - (a.winrate ?? 0),
  )
  const games = gameRows(matches)
  const extra = (r: BreakdownRow) => {
    const g = games.filter((x) => x.match.opponent.legendId === r.key)
    const f = tallyRows(g.filter((x) => x.game!.iWentFirst === true))
    const s = tallyRows(g.filter((x) => x.game!.iWentFirst === false))
    const margin = averageMargin(g)
    return (
      <>
        <span>1er : {f.n ? `${pct(f.winrate)} (${record(f)})` : '—'}</span>
        <span>2e : {s.n ? `${pct(s.winrate)} (${record(s)})` : '—'}</span>
        {margin.avg != null && <span>Écart moy. : {margin.avg > 0 ? '+' : ''}{margin.avg.toFixed(1).replace('.', ',')}</span>}
      </>
    )
  }
  return (
    <section className="card">
      <h2>Par légende adverse</h2>
      <div className="controls">
        <Segmented<"match" | "game">
          size="sm"
          value={unit}
          options={[
            { value: 'match', label: 'Matchs' },
            { value: 'game', label: 'Games' },
          ]}
          onChange={setUnit}
        />
        <Segmented<"n" | "worst" | "best">
          size="sm"
          value={sort}
          options={[
            { value: 'n', label: 'Fréquents' },
            { value: 'worst', label: 'Pires' },
            { value: 'best', label: 'Meilleurs' },
          ]}
          onChange={setSort}
        />
      </div>
      <StatTable rows={rows} unit={unit} extra={extra} onRowClick={(r) => r.key !== '__none' && navigate(`matchup/${r.key}`)} />
      <p className="muted small">
        La zone claire derrière chaque barre montre la fourchette probable du vrai winrate : plus elle est large, moins
        l’échantillon est fiable. Le trait central marque 50 %.
      </p>
    </section>
  )
}

function Section({ title, rows, unit, hint }: { title: string; rows: BreakdownRow[]; unit: 'match' | 'game'; hint?: string }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {hint && <p className="muted small">{hint}</p>}
      <StatTable rows={rows} unit={unit} />
    </section>
  )
}

function Factors({ data, matches }: ViewProps) {
  const games = gameRows(matches)
  const d = (id: string) => getDimension(data, id)
  return (
    <>
      <Section title="Premier ou second" rows={breakdown(games, d('wentFirst'))} unit="game" />
      <Section
        title="G1 vs après side"
        rows={breakdown(games, d('gameIndex'))}
        unit="game"
        hint="Si tes G2/G3 sont bien en dessous de tes G1, ton plan de side est à revoir."
      />
      <Section
        title="Écart de score"
        rows={breakdown(games, d('margin'))}
        unit="game"
        hint="Beaucoup de défaites serrées = match-ups jouables, à travailler. Des défaites larges = problème de fond."
      />
      <Section title="Mon battlefield" rows={breakdown(games, d('myBattlefield'))} unit="game" />
      <Section title="Battlefield adverse" rows={breakdown(games, d('oppBattlefield'))} unit="game" />
    </>
  )
}

function Reasons({ data, matches }: ViewProps) {
  const counts = [...tagCounts(matches).entries()].map(([id, c]) => ({
    id,
    name: data.reasonTags.find((t) => t.id === id)?.name ?? '?',
    ...c,
  }))
  const losses = counts.filter((c) => c.inLosses > 0).sort((a, b) => b.inLosses - a.inLosses)
  const wins = counts.filter((c) => c.inWins > 0).sort((a, b) => b.inWins - a.inWins)
  const maxL = Math.max(1, ...losses.map((c) => c.inLosses))
  const maxW = Math.max(1, ...wins.map((c) => c.inWins))
  const comments = sortMatchesDesc(matches).filter((m) => m.result === 'L' && (m.comment || m.games.some((g) => g.note)))
  return (
    <>
      <section className="card">
        <h2>Pourquoi je perds</h2>
        <TagBars items={losses.map((c) => ({ id: c.id, name: c.name, n: c.inLosses }))} max={maxL} tone="bad" />
      </section>
      <section className="card">
        <h2>Pourquoi je gagne</h2>
        <TagBars items={wins.map((c) => ({ id: c.id, name: c.name, n: c.inWins }))} max={maxW} tone="good" />
      </section>
      <section className="card">
        <h2>Mes notes sur les défaites</h2>
        {comments.length ? (
          <ul className="notes-list">
            {comments.slice(0, 30).map((m) => (
              <li key={m.id}>
                <button className="plain note-item" onClick={() => navigate(`match/${m.id}`)}>
                  <span className="muted small">
                    {m.date} · vs {data.legends.find((l) => l.id === m.opponent.legendId)?.name ?? '?'}
                  </span>
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
        ) : (
          <p className="muted">Aucun commentaire sur tes défaites. Les écrire aide à repérer ce qui revient.</p>
        )}
      </section>
    </>
  )
}

function TagBars({ items, max, tone }: { items: { id: string; name: string; n: number }[]; max: number; tone: 'good' | 'bad' }) {
  if (!items.length) return <p className="muted">Aucun tag saisi. Ajoute des « Pourquoi ? » dans tes games.</p>
  return (
    <ul className="tag-bars">
      {items.map((i) => (
        <li key={i.id}>
          <span className="tb-label">{i.name}</span>
          <span className="tb-track">
            <span className={`tb-fill ${tone}`} style={{ width: `${(i.n / max) * 100}%` }} />
          </span>
          <span className="tb-n">{i.n}</span>
        </li>
      ))}
    </ul>
  )
}

function DecksTab({ data, matches }: ViewProps) {
  const rows = matchRows(matches)
  const d = (id: string) => getDimension(data, id)
  return (
    <>
      <Section title="Mes decks" rows={breakdown(rows, d('myDeck'))} unit="match" />
      <Section title="Ma légende" rows={breakdown(rows, d('myLegend'))} unit="match" />
      <Section title="Type de tournoi" rows={breakdown(rows, d('tournamentType'))} unit="match" />
      <Section title="Par mois" rows={breakdown(rows, d('month'))} unit="match" />
      <Section title="Par ronde" rows={breakdown(rows, d('round'))} unit="match" hint="Les dernières rondes sont-elles plus dures (fatigue, meilleurs joueurs) ?" />
    </>
  )
}

function Explore({ data, matches }: ViewProps) {
  const dims = buildDimensions(data)
  const [dimId, setDimId] = useState('oppLegend')
  const [crossId, setCrossId] = useState('')
  const [unitPref, setUnitPref] = useState<'match' | 'game'>('match')
  const dim = dims.find((x) => x.id === dimId) ?? dims[0]
  const cross = dims.find((x) => x.id === crossId)
  const needsGame = dim.level === 'game' || cross?.level === 'game'
  const unit = needsGame ? 'game' : unitPref
  const rows = unit === 'match' ? matchRows(matches) : gameRows(matches)
  const main = breakdown(rows, dim)

  const select = (value: string, onChange: (v: string) => void, withNone?: boolean, exclude?: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {withNone && <option value="">— aucun —</option>}
      {dims
        .filter((x: Dimension) => x.id !== exclude)
        .map((x) => (
          <option key={x.id} value={x.id}>
            {x.label}
            {x.level === 'game' ? ' (games)' : ''}
          </option>
        ))}
    </select>
  )

  return (
    <>
      <section className="card">
        <h2>Explorer</h2>
        <p className="muted small">Choisis n’importe quel critère, y compris tes champs personnalisés (★), et croise-le avec un autre.</p>
        <label className="field">
          <span className="field-label">Découper par</span>
          {select(dimId, setDimId)}
        </label>
        <label className="field">
          <span className="field-label">Croiser avec</span>
          {select(crossId, setCrossId, true, dimId)}
        </label>
        <Segmented
          size="sm"
          value={unit}
          options={[
            { value: 'match', label: 'Matchs' },
            { value: 'game', label: 'Games' },
          ]}
          onChange={(v) => !needsGame && setUnitPref(v)}
        />
        {needsGame && <p className="muted small">Ce critère se mesure game par game.</p>}
      </section>
      {!cross ? (
        <section className="card">
          <h2>{dim.label}</h2>
          <StatTable rows={main} unit={unit} />
        </section>
      ) : (
        main.map((r) => (
          <section className="card" key={r.key}>
            <h2 className="cross-head">
              <span>{r.label}</span>
              <span className="muted small">{record(r)}</span>
              <WinratePill t={r} />
            </h2>
            <StatTable rows={breakdown(rows.filter((x) => (dim.keys(x).length ? dim.keys(x) : ['__none']).includes(r.key)), cross)} unit={unit} />
          </section>
        ))
      )}
    </>
  )
}
