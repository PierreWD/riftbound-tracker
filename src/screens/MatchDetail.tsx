import { useState } from 'react'
import { useStore } from '../data/store'
import { deckLabel, gameScore, nameOf, OUTCOME_LABEL } from '../data/matchUtils'
import { goBack, navigate } from '../router'
import { Confirm, Empty } from '../components/ui'
import { Icon } from '../components/Icon'
import { ResultBadge } from '../components/stats'
import { formatCustomValue } from '../components/CustomFieldInput'
import { toast } from '../components/toast'
import { formatDay } from './MatchList'
import type { CustomValues } from '../data/schema'

export function MatchDetail({ matchId }: { matchId: string }) {
  const { data, deleteMatch } = useStore()
  const [confirm, setConfirm] = useState(false)
  const m = data.matches.find((x) => x.id === matchId)
  if (!m) return <Empty title="Match introuvable" />

  const deck = data.decks.find((d) => d.id === m.myDeckId)
  const tags = (ids: string[]) => ids.map((id) => nameOf(data.reasonTags, id))
  const customs = (values: CustomValues) =>
    data.customFields
      .filter((f) => values[f.id] != null)
      .map((f) => (
        <div key={f.id} className="kv">
          <span>★ {f.label}</span>
          <span>{formatCustomValue(values[f.id])}</span>
        </div>
      ))

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('matches')} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>Match</h1>
        <button className="icon-btn" onClick={() => navigate(`match/${m.id}/edit`)} aria-label="Modifier">
          <Icon name="edit" />
        </button>
        <button className="icon-btn" onClick={() => setConfirm(true)} aria-label="Supprimer">
          <Icon name="trash" />
        </button>
      </header>

      <section className={`card hero r-${m.result}`}>
        <ResultBadge result={m.result} />
        <div>
          <div className="hero-title">
            {OUTCOME_LABEL[m.result]} {gameScore(m)} vs {nameOf(data.legends, m.opponent.legendId)}
          </div>
          <div className="muted small">
            {formatDay(m.date)} · {nameOf(data.tournamentTypes, m.tournamentTypeId)}
            {m.tournamentName ? ` · ${m.tournamentName}` : ''}
            {m.round ? ` · Ronde ${m.round}` : ''}
          </div>
        </div>
      </section>

      <button className="btn block" onClick={() => navigate(`matchup/${m.opponent.legendId}`)}>
        <Icon name="chart" size={18} /> Stats du match-up vs {nameOf(data.legends, m.opponent.legendId)}
      </button>

      <section className="card">
        <h2>Mon deck</h2>
        <p>
          <strong>{deckLabel(data, m.myDeckId)}</strong>
        </p>
        {deck?.comment && <p className="muted">{deck.comment}</p>}
        {m.myDeckNote && <p className="note">Pour ce match : {m.myDeckNote}</p>}
      </section>

      <section className="card">
        <h2>Adversaire</h2>
        <p>
          <strong>{nameOf(data.legends, m.opponent.legendId)}</strong>
          {m.opponent.deckName && ` · ${m.opponent.deckName}`}
          {m.opponent.name && <span className="muted"> — {m.opponent.name}</span>}
        </p>
        {m.opponent.comment && <p className="note">{m.opponent.comment}</p>}
      </section>

      {m.games.map((g) => (
        <section key={g.index} className={`card game-card r-${g.result}`}>
          <div className="game-head">
            <h3>Game {g.index}</h3>
            <ResultBadge result={g.result} />
            <span className="muted small">
              {g.iWentFirst == null ? '' : g.iWentFirst ? 'Je commence' : 'Je suis second'}
            </span>
            {g.myScore != null && g.oppScore != null && (
              <strong className="game-points">
                {g.myScore} – {g.oppScore}
              </strong>
            )}
          </div>
          {(g.myBattlefieldId || g.oppBattlefieldId) && (
            <div className="kv">
              <span>Battlefields</span>
              <span>
                {nameOf(data.battlefields, g.myBattlefieldId)} / {nameOf(data.battlefields, g.oppBattlefieldId)}
              </span>
            </div>
          )}
          {g.reasonTagIds.length > 0 && (
            <div className="chips static">
              {tags(g.reasonTagIds).map((t) => (
                <span key={t} className="chip on">
                  {t}
                </span>
              ))}
            </div>
          )}
          {customs(g.custom)}
          {g.note && <p className="note">{g.note}</p>}
        </section>
      ))}

      {(m.reasonTagIds.length > 0 || m.comment || Object.keys(m.custom).length > 0) && (
        <section className="card">
          <h2>Bilan</h2>
          {m.reasonTagIds.length > 0 && (
            <div className="chips static">
              {tags(m.reasonTagIds).map((t) => (
                <span key={t} className="chip on">
                  {t}
                </span>
              ))}
            </div>
          )}
          {customs(m.custom)}
          {m.comment && <p className="note">{m.comment}</p>}
        </section>
      )}

      {confirm && (
        <Confirm
          title="Supprimer ce match ?"
          message="Cette action est définitive."
          confirmLabel="Supprimer"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            deleteMatch(m.id)
            toast('Match supprimé')
            navigate('matches', true)
          }}
        />
      )}
    </div>
  )
}
