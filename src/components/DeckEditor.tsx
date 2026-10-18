import { useState } from 'react'
import type { Deck } from '../data/schema'
import { useStore } from '../data/store'
import { uid } from '../data/ids'
import { Field, PickerField, Sheet } from './ui'

export function DeckEditor({ deck, onClose, onSaved }: { deck?: Deck; onClose(): void; onSaved?(id: string): void }) {
  const { data, saveDeck, addListItem } = useStore()
  const [draft, setDraft] = useState<Deck>(
    deck ?? { id: uid('deck-'), legendId: '', name: '', comment: '', archived: false },
  )
  const [error, setError] = useState('')
  const save = () => {
    if (!draft.legendId) return setError('Choisis la légende du deck.')
    saveDeck({ ...draft, name: draft.name.trim(), comment: draft.comment.trim() })
    onSaved?.(draft.id)
    onClose()
  }
  return (
    <Sheet title={deck ? 'Modifier le deck' : 'Nouveau deck'} onClose={onClose}>
      <PickerField
        label="Légende"
        value={draft.legendId}
        items={data.legends}
        onChange={(id) => setDraft({ ...draft, legendId: id ?? '' })}
        onAdd={(name) => addListItem('legends', name)}
      />
      <Field label="Nom / version" hint="Ex. « Aggro v2 », « liste de Nexus Night »">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Optionnel" />
      </Field>
      <Field label="Commentaire">
        <textarea
          rows={3}
          value={draft.comment}
          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          placeholder="Choix de cartes, plan de jeu, changements…"
        />
      </Field>
      {deck && (
        <label className="toggle-row">
          <input type="checkbox" checked={draft.archived} onChange={(e) => setDraft({ ...draft, archived: e.target.checked })} />
          Archivé (caché dans la saisie, gardé dans les stats)
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn primary block" onClick={save}>
        Enregistrer
      </button>
    </Sheet>
  )
}
