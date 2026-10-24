import { useEffect, useMemo, useState } from 'react'
import type { AppData, Game, Match } from '../data/schema'
import { useStore } from '../data/store'
import { todayISO, uid } from '../data/ids'
import { computeResult, deckLabel, gameScore, nameOf, OUTCOME_LABEL, sortMatchesDesc } from '../data/matchUtils'
import { goBack, navigate } from '../router'
import { Chips, Field, PickerField, Stepper } from '../components/ui'
import { GameCard, type GameDraft } from '../components/GameCard'
import { DeckEditor } from '../components/DeckEditor'
import { CustomFieldsForm } from '../components/CustomFieldInput'
import { Icon } from '../components/Icon'
import { toast } from '../components/toast'
import { readPrefill, writePrefill } from '../live/liveMatch'

type Draft = Omit<Match, 'games' | 'result'> & { games: GameDraft[] }

const DRAFT_KEY = 'riftbound-draft'

const emptyGame = (index: number): GameDraft => ({ index, reasonTagIds: [], custom: {} })

function padGames(games: GameDraft[]): GameDraft[] {
  return [1, 2, 3].map((i) => games.find((g) => g.index === i) ?? emptyGame(i))
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* rien */
  }
}

/** Nouveau match : on reprend le contexte du dernier match saisi (même tournoi si c'est aujourd'hui). */
function freshDraft(data: AppData): Draft {
  const last = sortMatchesDesc(data.matches)[0]
  const today = todayISO()
  const sameEvent = !!last && last.date === today
  const now = new Date().toISOString()
  return {
    id: uid('m-'),
    createdAt: now,
    updatedAt: now,
    date: today,
    tournamentTypeId: last?.tournamentTypeId ?? data.tournamentTypes[0]?.id ?? '',
    tournamentName: sameEvent ? last.tournamentName : undefined,
    round: sameEvent ? (last.round ?? 0) + 1 : 1,
    myDeckId: last?.myDeckId ?? data.decks.find((d) => !d.archived)?.id ?? '',
    opponent: { legendId: '' },
    games: padGames([]),
    reasonTagIds: [],
    custom: {},
  }
}

export function MatchForm({ matchId }: { matchId?: string }) {
  const { data, saveMatch, addListItem } = useStore()
  const existing = matchId ? data.matches.find((m) => m.id === matchId) : undefined

  const initial = useMemo<{ draft: Draft; restored: boolean; prefilled: boolean }>(() => {
    if (existing) return { draft: { ...existing, games: padGames(existing.games) }, restored: false, prefilled: false }
    // Match qui sort du compagnon de partie : prioritaire sur un vieux brouillon
    const prefill = readPrefill()
    if (prefill) {
      const fresh = freshDraft(data)
      return {
        draft: {
          ...fresh,
          myDeckId: prefill.myDeckId || fresh.myDeckId,
          opponent: { ...prefill.opponent },
          games: padGames(prefill.games),
        },
        restored: false,
        prefilled: true,
      }
    }
    const saved = readDraft()
    if (saved) return { draft: { ...saved, games: padGames(saved.games) }, restored: true, prefilled: false }
    return { draft: freshDraft(data), restored: false, prefilled: false }
  }, [matchId])

  // Le pré-remplissage est consommé une fois copié dans le brouillon (sauvegardé automatiquement ci-dessous)
  useEffect(() => {
    if (initial.prefilled) writePrefill(null)
  }, [initial])

  const [draft, setDraft] = useState<Draft>(initial.draft)
  const [restored, setRestored] = useState(initial.restored)
  const [prefilled, setPrefilled] = useState(initial.prefilled)
  const [deckEditor, setDeckEditor] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [showDeckNote, setShowDeckNote] = useState(!!initial.draft.myDeckNote)

  // Brouillon auto-sauvegardé pour un nouveau match (si on quitte l'appli en plein tournoi)
  useEffect(() => {
    if (existing) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* stockage indisponible */
    }
  }, [draft, existing])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setOpp = (patch: Partial<Draft['opponent']>) => setDraft((d) => ({ ...d, opponent: { ...d.opponent, ...patch } }))

  const setGame = (g: GameDraft) =>
    setDraft((d) => {
      const games = d.games.map((x) => (x.index === g.index ? g : x))
      // Le perdant d'une game choisit souvent de commencer la suivante : on pré-remplit.
      const prev = d.games.find((x) => x.index === g.index)
      const next = games.find((x) => x.index === g.index + 1)
      if (next && g.result && g.result !== prev?.result && next.iWentFirst == null && !next.result && g.result !== 'D') {
        games[g.index] = { ...next, iWentFirst: g.result === 'L' }
      }
      return { ...d, games }
    })

  const played = draft.games.filter((g) => g.result)
  const g1 = draft.games[0]
  const g2 = draft.games[1]
  const split = !!g1.result && !!g2.result && g1.result !== g2.result && g1.result !== 'D' && g2.result !== 'D'
  const showG3 = split || !!draft.games[2].result
  const result = computeResult(played as Game[])

  const decks = data.decks
    .filter((d) => !d.archived || d.id === draft.myDeckId)
    .map((d) => ({ id: d.id, name: deckLabel(data, d.id), sub: d.comment || undefined }))
  const oppDeckSuggestions = useMemo(
    () =>
      [
        ...new Set(
          data.matches
            .filter((m) => m.opponent.legendId === draft.opponent.legendId && m.opponent.deckName)
            .map((m) => m.opponent.deckName!),
        ),
      ],
    [data.matches, draft.opponent.legendId],
  )
  const tournamentNames = useMemo(
    () => [...new Set(sortMatchesDesc(data.matches).map((m) => m.tournamentName).filter(Boolean))] as string[],
    [data.matches],
  )

  const submit = () => {
    const errs: string[] = []
    if (!draft.myDeckId) errs.push('Choisis ton deck.')
    if (!draft.opponent.legendId) errs.push("Choisis la légende de l'adversaire.")
    if (!played.length) errs.push('Indique le résultat d’au moins une game.')
    if (!draft.tournamentTypeId) errs.push('Choisis le type de tournoi.')
    setErrors(errs)
    if (errs.length) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }
    const games = (showG3 ? played : played.filter((g) => g.index < 3)) as Game[]
    const match: Match = {
      ...draft,
      tournamentName: draft.tournamentName?.trim() || undefined,
      myDeckNote: draft.myDeckNote?.trim() || undefined,
      comment: draft.comment?.trim() || undefined,
      opponent: {
        legendId: draft.opponent.legendId,
        name: draft.opponent.name?.trim() || undefined,
        deckName: draft.opponent.deckName?.trim() || undefined,
        comment: draft.opponent.comment?.trim() || undefined,
      },
      games,
      result: computeResult(games),
    }
    saveMatch(match)
    if (!existing) clearDraft()
    toast(existing ? 'Match modifié' : `Match enregistré : ${OUTCOME_LABEL[match.result]} ${gameScore(match)}`)
    if (existing) goBack(`match/${match.id}`)
    else navigate('matches')
  }

  const discardDraft = () => {
    clearDraft()
    setRestored(false)
    setDraft(freshDraft(data))
  }

  return (
    <div className="screen form-screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => goBack('matches')} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>{existing ? 'Modifier le match' : 'Nouveau match'}</h1>
      </header>

      {prefilled && (
        <div className="banner">
          Pré-rempli depuis la partie : vérifie, puis ajoute battlefields, tags et commentaires.{' '}
          <button className="link" onClick={() => setPrefilled(false)}>
            OK
          </button>
        </div>
      )}

      {restored && (
        <div className="banner">
          Brouillon restauré.{' '}
          <button className="link" onClick={discardDraft}>
            Repartir de zéro
          </button>
        </div>
      )}

      <section className="card">
        <h2>Tournoi</h2>
        <div className="two-col">
          <Field label="Date">
            <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <div className="field">
            <span className="field-label">Ronde</span>
            <Stepper label="Ronde" value={draft.round} min={1} max={20} onChange={(v) => set({ round: v })} />
          </div>
        </div>
        <span className="field-label">Type</span>
        <Chips
          options={data.tournamentTypes}
          selected={[draft.tournamentTypeId]}
          onToggle={(id) => set({ tournamentTypeId: id })}
        />
        <Field label="Nom du tournoi / lieu">
          <input
            list="tournament-names"
            value={draft.tournamentName ?? ''}
            onChange={(e) => set({ tournamentName: e.target.value })}
            placeholder="Optionnel"
          />
          <datalist id="tournament-names">
            {tournamentNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
      </section>

      <section className="card">
        <h2>Mon deck</h2>
        {decks.length ? (
          <PickerField label="Deck joué" value={draft.myDeckId} items={decks} onChange={(id) => set({ myDeckId: id ?? '' })} />
        ) : (
          <p className="muted">Tu n’as pas encore de deck enregistré.</p>
        )}
        <div className="link-row">
          <button type="button" className="link small" onClick={() => setDeckEditor(true)}>
            + Nouveau deck
          </button>
          {!showDeckNote && (
            <button type="button" className="link small" onClick={() => setShowDeckNote(true)}>
              + Note sur mon deck pour ce match
            </button>
          )}
        </div>
        {showDeckNote && (
          <Field label="Note sur mon deck pour ce match">
            <textarea rows={2} value={draft.myDeckNote ?? ''} onChange={(e) => set({ myDeckNote: e.target.value })} />
          </Field>
        )}
      </section>

      <section className="card">
        <h2>Adversaire</h2>
        <PickerField
          label="Légende adverse"
          value={draft.opponent.legendId}
          items={data.legends}
          onChange={(id) => setOpp({ legendId: id ?? '' })}
          onAdd={(name) => addListItem('legends', name)}
        />
        <div className="two-col">
          <Field label="Nom du joueur">
            <input value={draft.opponent.name ?? ''} onChange={(e) => setOpp({ name: e.target.value })} placeholder="Optionnel" />
          </Field>
          <Field label="Deck / archétype">
            <input
              list="opp-decks"
              value={draft.opponent.deckName ?? ''}
              onChange={(e) => setOpp({ deckName: e.target.value })}
              placeholder="Ex. aggro"
            />
            <datalist id="opp-decks">
              {oppDeckSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Commentaire sur son deck">
          <textarea
            rows={2}
            value={draft.opponent.comment ?? ''}
            onChange={(e) => setOpp({ comment: e.target.value })}
            placeholder="Cartes clés vues, plan de jeu…"
          />
        </Field>
      </section>

      {draft.games.slice(0, showG3 ? 3 : 2).map((g) => (
        <GameCard
          key={g.index}
          data={data}
          game={g}
          onChange={setGame}
          onAddBattlefield={(name) => addListItem('battlefields', name)}
        />
      ))}

      <section className="card">
        <h2>Bilan du match</h2>
        <div className={`result-summary r-${played.length ? result : 'none'}`}>
          {played.length ? (
            <>
              {OUTCOME_LABEL[result]} <strong>{gameScore({ games: played } as Match)}</strong>
              {draft.opponent.legendId && <> vs {nameOf(data.legends, draft.opponent.legendId)}</>}
            </>
          ) : (
            'Renseigne le résultat des games'
          )}
        </div>
        <span className="field-label">Pourquoi j’ai gagné / perdu ?</span>
        <Chips
          options={data.reasonTags.map((t) => ({ id: t.id, name: t.name, hint: t.kind }))}
          selected={draft.reasonTagIds}
          onToggle={(id) =>
            set({
              reasonTagIds: draft.reasonTagIds.includes(id)
                ? draft.reasonTagIds.filter((x) => x !== id)
                : [...draft.reasonTagIds, id],
            })
          }
        />
        <CustomFieldsForm
          fields={data.customFields.filter((f) => f.scope === 'match')}
          values={draft.custom}
          onChange={(custom) => set({ custom })}
        />
        <Field label="Commentaire sur le match">
          <textarea
            rows={4}
            value={draft.comment ?? ''}
            onChange={(e) => set({ comment: e.target.value })}
            placeholder="Ce qui a marché, mes erreurs, ce que je ferais autrement…"
          />
        </Field>
      </section>

      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="sticky-actions">
        <button className="btn primary block big" onClick={submit}>
          <Icon name="check" size={20} /> {existing ? 'Enregistrer les modifications' : 'Enregistrer le match'}
        </button>
      </div>

      {deckEditor && <DeckEditor onClose={() => setDeckEditor(false)} onSaved={(id) => set({ myDeckId: id })} />}
    </div>
  )
}
