import { useEffect, useRef, useState } from 'react'
import type { Outcome } from '../data/schema'
import { useStore } from '../data/store'
import { deckLabel, deckLegendId, nameOf, sortMatchesDesc } from '../data/matchUtils'
import { navigate } from '../router'
import {
  coinToss,
  currentGame,
  endMatch,
  finishGame,
  formatClock,
  gameWins,
  isRunning,
  loadLive,
  loadPrefs,
  newLiveMatch,
  pauseTimer,
  remainingMs,
  reopenLastGame,
  saveLive,
  savePrefs,
  setFirst,
  setScore,
  startGame,
  startTimer,
  suggestedResult,
  toPrefill,
  writePrefill,
  type LiveMatch,
} from '../live/liveMatch'
import { Confirm, Field, PickerField, Segmented, Sheet } from '../components/ui'
import { DeckEditor } from '../components/DeckEditor'
import { Icon } from '../components/Icon'
import { ResultBadge } from '../components/stats'

const ROUND_MINUTES = [30, 40, 50, 55, 60]
const OUTCOME_TEXT: Record<Outcome, string> = { W: 'Victoire', L: 'Défaite', D: 'Nul' }

/** Garde l'écran allumé pendant la partie (si le navigateur le permet). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let stopped = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (stopped) lock.release()
      } catch {
        /* refusé (batterie faible…) : pas grave */
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active])
}

/** Re-rendu régulier tant que le timer tourne. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [active])
  return active ? now : Date.now()
}

export function Companion() {
  const { data } = useStore()
  const [m, setM] = useState<LiveMatch>(() => {
    const saved = loadLive()
    if (saved) return saved
    const prefs = loadPrefs()
    const lastDeck = sortMatchesDesc(data.matches)[0]?.myDeckId ?? data.decks.find((d) => !d.archived)?.id
    return newLiveMatch({ myDeckId: lastDeck, minutes: prefs?.minutes, facing: prefs?.facing })
  })

  useEffect(() => saveLive(m), [m])

  const inGame = m.phase === 'playing' || m.phase === 'between' || m.phase === 'done'
  useWakeLock(m.phase === 'playing' || m.phase === 'between')

  if (m.phase === 'setup') return <Setup m={m} setM={setM} />
  if (m.phase === 'toss') return <Toss m={m} setM={setM} />
  return inGame ? <Board m={m} setM={setM} /> : null
}

// ---------------------------------------------------------------- Préparation

function Setup({ m, setM }: { m: LiveMatch; setM(m: LiveMatch): void }) {
  const { data, addListItem } = useStore()
  const [deckEditor, setDeckEditor] = useState(false)
  const [error, setError] = useState('')
  const decks = data.decks.filter((d) => !d.archived || d.id === m.myDeckId)

  const go = (next: (m: LiveMatch) => LiveMatch) => {
    if (!m.myDeckId) return setError('Choisis ton deck.')
    if (!m.oppLegendId) return setError("Choisis la légende de l'adversaire.")
    savePrefs({ minutes: m.timer.minutes, facing: m.facing })
    setM(next(m))
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <h1>Partie</h1>
      </header>
      <p className="muted small">
        Compteur de points, timer de ronde et toss. À la fin du match, tes games sont envoyées dans le formulaire pour
        tes stats.
      </p>

      <section className="card vs-card">
        <div className="vs-side">
          <span className="field-label">Moi</span>
          {decks.length ? (
            <PickerField
              label="Mon deck"
              value={m.myDeckId}
              items={decks.map((d) => ({ id: d.id, name: deckLabel(data, d.id), sub: d.comment || undefined }))}
              onChange={(id) => setM({ ...m, myDeckId: id ?? '' })}
            />
          ) : (
            <p className="muted small">Aucun deck enregistré.</p>
          )}
          <button type="button" className="link small" onClick={() => setDeckEditor(true)}>
            + Nouveau deck
          </button>
        </div>
        <div className="vs-sep" aria-hidden="true">
          VS
        </div>
        <div className="vs-side">
          <span className="field-label">Adversaire</span>
          <PickerField
            label="Sa légende"
            value={m.oppLegendId}
            items={data.legends}
            onChange={(id) => setM({ ...m, oppLegendId: id ?? '' })}
            onAdd={(name) => addListItem('legends', name)}
          />
          <Field label="Son nom">
            <input value={m.oppName ?? ''} onChange={(e) => setM({ ...m, oppName: e.target.value })} placeholder="Optionnel" />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2>Timer de ronde</h2>
        <div className="chips">
          {ROUND_MINUTES.map((min) => (
            <button
              key={min}
              type="button"
              className={`chip ${m.timer.minutes === min ? 'on' : ''}`}
              onClick={() => setM({ ...m, timer: { ...m.timer, minutes: min } })}
            >
              {min} min
            </button>
          ))}
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={m.facing} onChange={(e) => setM({ ...m, facing: e.target.checked })} />
          Mode face à face (le score adverse s'affiche à l'envers pour ton adversaire)
        </label>
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn primary block big" onClick={() => go((x) => ({ ...x, phase: 'toss', toss: undefined }))}>
        <Icon name="coin" size={20} /> Toss : qui commence ?
      </button>
      <div className="row-actions">
        <button className="btn" onClick={() => go((x) => startGame(x, true))}>
          Je commence
        </button>
        <button className="btn" onClick={() => go((x) => startGame(x, false))}>
          Il commence
        </button>
      </div>

      {deckEditor && <DeckEditor onClose={() => setDeckEditor(false)} onSaved={(id) => setM({ ...m, myDeckId: id })} />}
    </div>
  )
}

// ---------------------------------------------------------------- Toss

function Toss({ m, setM }: { m: LiveMatch; setM(m: LiveMatch): void }) {
  const { data } = useStore()
  const [spinning, setSpinning] = useState(m.toss == null)
  const opp = nameOf(data.legends, m.oppLegendId)
  const me = nameOf(data.legends, deckLegendId(data, m.myDeckId))

  const flip = () => {
    setSpinning(true)
    const result = coinToss()
    setTimeout(() => {
      setSpinning(false)
      setM({ ...m, toss: result })
    }, 1200)
  }

  // premier lancer automatique
  const started = useRef(false)
  useEffect(() => {
    if (m.toss == null && !started.current) {
      started.current = true
      flip()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen toss-screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => setM({ ...m, phase: 'setup' })} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>Toss</h1>
      </header>
      <div className="coin-stage">
        <div className={`coin ${spinning ? 'spinning' : m.toss ? 'me' : 'opp'}`} aria-live="polite">
          <span>{spinning ? '?' : m.toss ? 'MOI' : 'LUI'}</span>
        </div>
        <p className="toss-result">
          {spinning ? 'Lancer…' : m.toss ? `Tu commences (${me})` : `${opp} commence`}
        </p>
      </div>
      {!spinning && m.toss != null && (
        <div className="stack">
          <button className="btn primary block big" onClick={() => setM(startGame(m, m.toss))}>
            <Icon name="play" size={20} /> Lancer la game 1
          </button>
          <div className="row-actions">
            <button className="btn" onClick={flip}>
              Relancer
            </button>
            <button className="btn" onClick={() => setM({ ...m, toss: !m.toss })}>
              Inverser
            </button>
          </div>
          <p className="muted small center">Selon les règles de ton tournoi, le gagnant du toss peut choisir de jouer second : utilise « Inverser ».</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Tableau de score

function Board({ m, setM }: { m: LiveMatch; setM(m: LiveMatch): void }) {
  const { data } = useStore()
  const now = useNow(isRunning(m.timer))
  const [endSheet, setEndSheet] = useState(false)
  const [menu, setMenu] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const game = currentGame(m)
  const wins = gameWins(m)
  const remaining = remainingMs(m.timer, now)
  const oppLegend = nameOf(data.legends, m.oppLegendId)
  const myLegend = nameOf(data.legends, deckLegendId(data, m.myDeckId))

  // vibration une seule fois quand le temps est écoulé
  const buzzed = useRef(remaining <= 0)
  useEffect(() => {
    if (remaining <= 0 && !buzzed.current) {
      buzzed.current = true
      navigator.vibrate?.([300, 150, 300, 150, 300])
    }
  }, [remaining])

  const score = (side: 'me' | 'opp', delta: number) => {
    const next = setScore(m, side, delta)
    // ouverture auto de la fin de game quand quelqu'un atteint 8
    if (!suggestedResult(game) && suggestedResult(currentGame(next))) setEndSheet(true)
    setM(next)
  }
  const toggleTimer = () => setM({ ...m, timer: isRunning(m.timer) ? pauseTimer(m.timer) : startTimer(m.timer) })

  const panel = (side: 'me' | 'opp') => {
    const isMe = side === 'me'
    const value = game ? (isMe ? game.myScore : game.oppScore) : 0
    const first = game?.iWentFirst == null ? false : isMe ? game.iWentFirst : !game.iWentFirst
    return (
      <div className={`score-panel ${side} ${m.facing && !isMe ? 'flipped' : ''}`}>
        <div className="sp-head">
          <span className="sp-name">{isMe ? `Moi · ${myLegend}` : `${m.oppName?.trim() || 'Adversaire'} · ${oppLegend}`}</span>
          {first && <span className="badge first">commence</span>}
          <span className="sp-wins" aria-label={`${isMe ? wins.me : wins.opp} games gagnées`}>
            {[0, 1].map((i) => (
              <i key={i} className={i < (isMe ? wins.me : wins.opp) ? 'on' : ''} />
            ))}
          </span>
        </div>
        <button className="sp-plus-area" onClick={() => score(side, 1)} disabled={!game} aria-label={`+1 point ${isMe ? 'pour moi' : 'adversaire'}`}>
          <span className="sp-score">
            {value}
            <small className="sp-target">/8</small>
          </span>
        </button>
        <div className="sp-buttons">
          <button onClick={() => score(side, -1)} disabled={!game || value === 0} aria-label="−1 point">
            −1
          </button>
          <button onClick={() => score(side, 1)} disabled={!game} aria-label="+1 point">
            +1
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="board">
      <div className="board-top">
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menu de la partie">
          <Icon name="menu" />
        </button>
        <button className={`clock ${remaining <= 0 ? 'over' : remaining < 5 * 60_000 ? 'low' : ''}`} onClick={toggleTimer}>
          {!isRunning(m.timer) && <Icon name="pause" size={16} />}
          <span>{formatClock(remaining)}</span>
        </button>
        <span className="board-games">
          G{game?.index ?? m.games.length} · {wins.me}-{wins.opp}
        </span>
      </div>

      {m.phase === 'playing' && (
        <>
          {panel('opp')}
          {panel('me')}
          <div className="board-bottom">
            <button className="btn primary block" onClick={() => setEndSheet(true)}>
              <Icon name="check" size={18} /> Fin de la game {game?.index}
            </button>
          </div>
        </>
      )}

      {m.phase === 'between' && <Between m={m} setM={setM} oppLegend={oppLegend} />}
      {m.phase === 'done' && <Done m={m} setM={setM} oppLegend={oppLegend} onQuit={() => setConfirmQuit(true)} />}

      {endSheet && game && (
        <Sheet title={`Qui a gagné la game ${game.index} ?`} onClose={() => setEndSheet(false)}>
          <p className="muted">
            Score : {game.myScore} – {game.oppScore}
          </p>
          <div className="stack">
            {(['W', 'L', 'D'] as Outcome[]).map((r) => (
              <button
                key={r}
                className={`btn block big end-${r} ${suggestedResult(game) === r ? 'suggested' : ''}`}
                onClick={() => {
                  setEndSheet(false)
                  setM(finishGame(m, r))
                }}
              >
                {r === 'W' ? 'J’ai gagné' : r === 'L' ? `${oppLegend} a gagné` : 'Nul (temps écoulé)'}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {menu && (
        <Sheet title="Partie" onClose={() => setMenu(false)}>
          <div className="stack">
            {m.phase === 'playing' && game && (
              <button
                className="btn block"
                onClick={() => {
                  setM(setFirst(m, !game.iWentFirst))
                  setMenu(false)
                }}
              >
                Inverser qui commence cette game
              </button>
            )}
            <button
              className="btn block"
              onClick={() => {
                toggleTimer()
                setMenu(false)
              }}
            >
              <Icon name={isRunning(m.timer) ? 'pause' : 'play'} size={18} /> {isRunning(m.timer) ? 'Mettre le timer en pause' : 'Reprendre le timer'}
            </button>
            {m.phase !== 'done' && (
              <button
                className="btn block"
                onClick={() => {
                  setM(endMatch(m))
                  setMenu(false)
                }}
              >
                Terminer le match maintenant
              </button>
            )}
            <button
              className="btn danger block"
              onClick={() => {
                setMenu(false)
                setConfirmQuit(true)
              }}
            >
              Abandonner sans enregistrer
            </button>
          </div>
          <p className="muted small">« Terminer maintenant » garde les games déjà finies (temps écoulé, Bo1…).</p>
        </Sheet>
      )}

      {confirmQuit && (
        <Confirm
          title="Abandonner la partie ?"
          message="Les scores de cette partie seront perdus et rien ne sera ajouté à tes stats."
          confirmLabel="Abandonner"
          danger
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => {
            saveLive(null)
            setConfirmQuit(false)
            const prefs = loadPrefs()
            setM(newLiveMatch({ myDeckId: m.myDeckId, minutes: prefs?.minutes, facing: prefs?.facing }))
          }}
        />
      )}
    </div>
  )
}

function GamesRecap({ m }: { m: LiveMatch }) {
  return (
    <ul className="games-recap">
      {m.games
        .filter((g) => g.result)
        .map((g) => (
          <li key={g.index}>
            <ResultBadge result={g.result!} />
            <span>Game {g.index}</span>
            <span className="muted small">{g.iWentFirst == null ? '' : g.iWentFirst ? 'je commence' : 'second'}</span>
            <strong>
              {g.myScore} – {g.oppScore}
            </strong>
            {g.startedAt != null && g.endedAt != null && (
              <span className="muted small">{Math.max(1, Math.round((g.endedAt - g.startedAt) / 60_000))} min</span>
            )}
          </li>
        ))}
    </ul>
  )
}

function Between({ m, setM, oppLegend }: { m: LiveMatch; setM(m: LiveMatch): void; oppLegend: string }) {
  const last = m.games[m.games.length - 1]
  const defaultFirst = last.result === 'L' ? true : last.result === 'W' ? false : last.iWentFirst ?? true
  const [first, setFirstChoice] = useState<'me' | 'opp'>(defaultFirst ? 'me' : 'opp')
  return (
    <div className="board-interlude">
      <div className="card">
        <h2>
          Game {last.index} : {OUTCOME_TEXT[last.result!]} {last.myScore}–{last.oppScore}
        </h2>
        <GamesRecap m={m} />
      </div>
      <div className="card">
        <h2>Game {last.index + 1} : qui commence ?</h2>
        <p className="muted small">D’habitude, le perdant de la game précédente choisit.</p>
        <Segmented<'me' | 'opp'>
          value={first}
          options={[
            { value: 'me', label: 'Je commence' },
            { value: 'opp', label: `${oppLegend} commence` },
          ]}
          onChange={setFirstChoice}
        />
        <button className="btn primary block big" onClick={() => setM(startGame(m, first === 'me'))}>
          <Icon name="play" size={20} /> Lancer la game {last.index + 1}
        </button>
      </div>
      <div className="link-row center-row">
        <button className="link small" onClick={() => setM(reopenLastGame(m))}>
          <Icon name="undo" size={14} /> Annuler la fin de game
        </button>
        <button className="link small" onClick={() => setM(endMatch(m))}>
          Terminer le match ici
        </button>
      </div>
    </div>
  )
}

function Done({ m, setM, oppLegend, onQuit }: { m: LiveMatch; setM(m: LiveMatch): void; oppLegend: string; onQuit(): void }) {
  const wins = gameWins(m)
  const result: Outcome = wins.me > wins.opp ? 'W' : wins.opp > wins.me ? 'L' : 'D'
  const hasGames = m.games.some((g) => g.result)
  const save = () => {
    writePrefill(toPrefill(m))
    saveLive(null)
    navigate('new')
  }
  return (
    <div className="board-interlude">
      <div className={`card hero r-${result}`}>
        <ResultBadge result={result} />
        <div>
          <div className="hero-title">
            {OUTCOME_TEXT[result]} {wins.me}-{wins.opp}
          </div>
          <div className="muted small">vs {oppLegend}{m.oppName?.trim() ? ` (${m.oppName.trim()})` : ''}</div>
        </div>
      </div>
      <div className="card">
        <GamesRecap m={m} />
        {!hasGames && <p className="muted">Aucune game terminée.</p>}
      </div>
      <button className="btn primary block big" onClick={save} disabled={!hasGames}>
        <Icon name="chart" size={20} /> Enregistrer dans mes stats
      </button>
      <p className="muted small center">Le formulaire s’ouvre pré-rempli : il te restera les battlefields, les tags et ton commentaire.</p>
      <div className="link-row center-row">
        {hasGames && (
          <button className="link small" onClick={() => setM(reopenLastGame(m))}>
            <Icon name="undo" size={14} /> Annuler la dernière game
          </button>
        )}
        <button className="link small danger-link" onClick={onQuit}>
          Abandonner sans enregistrer
        </button>
      </div>
    </div>
  )
}
