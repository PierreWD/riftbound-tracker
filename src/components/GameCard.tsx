import { useState } from 'react'
import type { AppData, Game, Outcome } from '../data/schema'
import { Chips, Field, PickerField, Segmented, Stepper } from './ui'
import { CustomFieldsForm } from './CustomFieldInput'

/** Game en cours de saisie : le résultat peut être vide (game non jouée). */
export type GameDraft = Omit<Game, 'result'> & { result?: Outcome }

export function GameCard({
  data,
  game,
  onChange,
  onAddBattlefield,
}: {
  data: AppData
  game: GameDraft
  onChange(g: GameDraft): void
  onAddBattlefield(name: string): string
}) {
  const [showMore, setShowMore] = useState(!!game.note)
  const set = (patch: Partial<GameDraft>) => onChange({ ...game, ...patch })
  const tags = data.reasonTags.filter(
    (t) => !game.result || game.result === 'D' || t.kind === 'both' || t.kind === (game.result === 'W' ? 'win' : 'loss'),
  )
  const gameFields = data.customFields.filter((f) => f.scope === 'game')
  return (
    <div className={`card game-card ${game.result ? `r-${game.result}` : ''}`}>
      <div className="game-head">
        <h3>Game {game.index}</h3>
        {game.index > 1 && <span className="muted small">après side</span>}
        {game.result && (
          <button type="button" className="link small" onClick={() => onChange({ index: game.index, reasonTagIds: [], custom: {} })}>
            Effacer
          </button>
        )}
      </div>
      <Segmented
        value={game.iWentFirst == null ? undefined : game.iWentFirst ? 'first' : 'second'}
        options={[
          { value: 'first', label: 'Je commence' },
          { value: 'second', label: 'Je suis second' },
        ]}
        onChange={(v) => set({ iWentFirst: v === 'first' })}
      />
      <Segmented
        value={game.result}
        options={[
          { value: 'W', label: 'Victoire', tone: 'win' },
          { value: 'L', label: 'Défaite', tone: 'loss' },
          { value: 'D', label: 'Nul', tone: 'draw' },
        ]}
        onChange={(v) => {
          // un score à 8 est rempli d'office pour le gagnant
          const patch: Partial<GameDraft> = { result: v }
          if (v === 'W' && game.myScore == null) patch.myScore = 8
          if (v === 'L' && game.oppScore == null) patch.oppScore = 8
          set(patch)
        }}
      />
      <div className="score-row">
        <div>
          <span className="field-label">Mes points</span>
          <Stepper label="Mes points" value={game.myScore} onChange={(v) => set({ myScore: v })} />
        </div>
        <div>
          <span className="field-label">Points adverses</span>
          <Stepper label="Points adverses" value={game.oppScore} onChange={(v) => set({ oppScore: v })} />
        </div>
      </div>
      <div className="two-col">
        <PickerField
          label="Mon battlefield"
          value={game.myBattlefieldId}
          items={data.battlefields}
          onChange={(id) => set({ myBattlefieldId: id })}
          onAdd={onAddBattlefield}
          allowClear
          placeholder="—"
        />
        <PickerField
          label="BF adverse"
          value={game.oppBattlefieldId}
          items={data.battlefields}
          onChange={(id) => set({ oppBattlefieldId: id })}
          onAdd={onAddBattlefield}
          allowClear
          placeholder="—"
        />
      </div>
      <span className="field-label">Pourquoi ?</span>
      <Chips
        options={tags.map((t) => ({ id: t.id, name: t.name, hint: t.kind }))}
        selected={game.reasonTagIds}
        onToggle={(id) =>
          set({
            reasonTagIds: game.reasonTagIds.includes(id)
              ? game.reasonTagIds.filter((x) => x !== id)
              : [...game.reasonTagIds, id],
          })
        }
      />
      <CustomFieldsForm fields={gameFields} values={game.custom} onChange={(custom) => set({ custom })} />
      {showMore ? (
        <Field label="Note sur la game">
          <textarea rows={2} value={game.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} />
        </Field>
      ) : (
        <button type="button" className="link small" onClick={() => setShowMore(true)}>
          + Ajouter une note
        </button>
      )}
    </div>
  )
}
