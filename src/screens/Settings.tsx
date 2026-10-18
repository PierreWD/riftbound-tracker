import { useEffect, useState } from 'react'
import type { CustomField, CustomFieldScope, CustomFieldType, Deck, ListKey, ReasonTag, TagKind } from '../data/schema'
import { useStore, usageCount } from '../data/store'
import { deckLabel } from '../data/matchUtils'
import { createDefaultData } from '../data/defaults'
import { createDemoData } from '../data/demo'
import { uid } from '../data/ids'
import { Confirm, Field, Segmented, Sheet } from '../components/ui'
import { DeckEditor } from '../components/DeckEditor'
import { ImportExportButtons, formatDate } from '../components/ImportExport'
import { Icon } from '../components/Icon'
import { toast } from '../components/toast'

const LISTS: { key: ListKey; title: string; hint: string }[] = [
  { key: 'legends', title: 'Légendes', hint: 'Les légendes proposées pour ton deck et celui de l’adversaire.' },
  { key: 'battlefields', title: 'Battlefields', hint: 'Tu peux aussi en ajouter directement pendant la saisie.' },
  { key: 'tournamentTypes', title: 'Types de tournoi', hint: 'Pre-Rift, Nexus Night, Skirmish…' },
  { key: 'reasonTags', title: 'Tags « Pourquoi ? »', hint: 'Raisons rapides de victoire ou de défaite.' },
]

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'select', label: 'Choix unique' },
  { value: 'tags', label: 'Choix multiple' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'number', label: 'Nombre' },
  { value: 'text', label: 'Texte' },
]

export function Settings() {
  const { data, replaceAll } = useStore()
  const [deck, setDeck] = useState<Deck | 'new' | null>(null)
  const [list, setList] = useState<ListKey | null>(null)
  const [field, setField] = useState<CustomField | 'new' | null>(null)
  const [confirm, setConfirm] = useState<'demo' | 'wipe' | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  const activeDecks = data.decks.filter((d) => !d.archived)
  const archived = data.decks.filter((d) => d.archived)
  const matchCount = (deckId: string) => data.matches.filter((m) => m.myDeckId === deckId).length

  return (
    <div className="screen">
      <header className="top-bar">
        <h1>Réglages</h1>
      </header>

      <section className="card">
        <h2>Mes données</h2>
        <p className="muted small">
          {data.matches.length} matchs enregistrés sur ce téléphone · dernier export : {formatDate(data.meta.lastExportAt)}
          {persisted === false && ' · stockage non garanti par le navigateur : exporte régulièrement'}
        </p>
        <ImportExportButtons />
        <p className="muted small">
          « Exporter » crée une sauvegarde complète (à réimporter plus tard) ou un fichier lisible pour une IA.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mes decks</h2>
          <button className="btn sm" onClick={() => setDeck('new')}>
            <Icon name="plus" size={16} /> Ajouter
          </button>
        </div>
        {!data.decks.length && <p className="muted">Aucun deck. Crée ton premier deck pour saisir tes matchs.</p>}
        <ul className="settings-list">
          {[...activeDecks, ...archived].map((d) => (
            <li key={d.id}>
              <button className="settings-row" onClick={() => setDeck(d)}>
                <span>
                  {deckLabel(data, d.id)}
                  {d.archived && <span className="badge">archivé</span>}
                  {d.comment && <span className="muted small block">{d.comment}</span>}
                </span>
                <span className="muted small">{matchCount(d.id)} matchs</span>
                <Icon name="chevron" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Champs personnalisés</h2>
          <button className="btn sm" onClick={() => setField('new')}>
            <Icon name="plus" size={16} /> Ajouter
          </button>
        </div>
        <p className="muted small">
          Ajoute tes propres infos à saisir (ex. « Mulligan », « Fatigue », « Temps restant »). Elles apparaissent dans la
          saisie et dans l’onglet Explorer de l’analyse.
        </p>
        <ul className="settings-list">
          {data.customFields.map((f) => (
            <li key={f.id}>
              <button className="settings-row" onClick={() => setField(f)}>
                <span>
                  ★ {f.label}
                  <span className="muted small block">
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label} · par {f.scope === 'game' ? 'game' : 'match'}
                    {f.options.length ? ` · ${f.options.join(', ')}` : ''}
                  </span>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Listes</h2>
        <ul className="settings-list">
          {LISTS.map((l) => (
            <li key={l.key}>
              <button className="settings-row" onClick={() => setList(l.key)}>
                <span>
                  {l.title}
                  <span className="muted small block">{l.hint}</span>
                </span>
                <span className="muted small">{data[l.key].length}</span>
                <Icon name="chevron" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Zone sensible</h2>
        <div className="stack">
          <button className="btn block" onClick={() => setConfirm('demo')}>
            Charger des données d’exemple
          </button>
          <button className="btn danger block" onClick={() => setConfirm('wipe')}>
            Tout effacer
          </button>
        </div>
      </section>

      <p className="muted small center">Riftbound Tracker v{__APP_VERSION__} · données stockées uniquement sur cet appareil</p>

      {deck && <DeckEditor deck={deck === 'new' ? undefined : deck} onClose={() => setDeck(null)} />}
      {list && <ListEditor listKey={list} onClose={() => setList(null)} />}
      {field && <CustomFieldEditor field={field === 'new' ? undefined : field} onClose={() => setField(null)} />}
      {confirm === 'demo' && (
        <Confirm
          title="Charger les données d’exemple ?"
          message={`Tes ${data.matches.length} matchs actuels seront remplacés par ~45 matchs fictifs. Exporte une sauvegarde avant si tu veux les garder.`}
          confirmLabel="Remplacer par l’exemple"
          danger={data.matches.length > 0}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            replaceAll(createDemoData())
            setConfirm(null)
            toast('Données d’exemple chargées')
          }}
        />
      )}
      {confirm === 'wipe' && (
        <Confirm
          title="Tout effacer ?"
          message="Tous les matchs, decks et réglages seront supprimés de ce téléphone. Cette action est définitive."
          confirmLabel="Tout effacer"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            replaceAll(createDefaultData())
            setConfirm(null)
            toast('Données effacées')
          }}
        />
      )}
    </div>
  )
}

function ListEditor({ listKey, onClose }: { listKey: ListKey; onClose(): void }) {
  const { data, addListItem, updateListItem, deleteListItem } = useStore()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<TagKind>('loss')
  const meta = LISTS.find((l) => l.key === listKey)!
  const items = data[listKey] as (ReasonTag | { id: string; name: string; kind?: TagKind })[]
  const isTags = listKey === 'reasonTags'
  const add = () => {
    const n = name.trim()
    if (!n) return
    addListItem(listKey, n, isTags ? kind : undefined)
    setName('')
  }
  return (
    <Sheet title={meta.title} onClose={onClose}>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ajouter…" />
        <button className="btn primary" type="submit" aria-label="Ajouter">
          <Icon name="plus" size={18} />
        </button>
      </form>
      {isTags && (
        <Segmented<TagKind>
          size="sm"
          value={kind}
          options={[
            { value: 'loss', label: 'Défaite' },
            { value: 'win', label: 'Victoire' },
            { value: 'both', label: 'Les deux' },
          ]}
          onChange={setKind}
        />
      )}
      <ul className="edit-list">
        {items.map((item) => {
          const used = usageCount(data, listKey, item.id)
          return (
            <li key={item.id}>
              <input
                defaultValue={item.name}
                aria-label="Nom"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== item.name) updateListItem(listKey, item.id, { name: v })
                  else e.target.value = item.name
                }}
              />
              {isTags && (
                <select
                  value={item.kind}
                  aria-label="Type de tag"
                  onChange={(e) => updateListItem(listKey, item.id, { kind: e.target.value as TagKind })}
                >
                  <option value="loss">Déf.</option>
                  <option value="win">Vict.</option>
                  <option value="both">Les deux</option>
                </select>
              )}
              {used ? (
                <span className="muted small" title="Utilisé : renomme-le plutôt que de le supprimer">
                  ×{used}
                </span>
              ) : (
                <button className="icon-btn sm" onClick={() => deleteListItem(listKey, item.id)} aria-label={`Supprimer ${item.name}`}>
                  <Icon name="trash" size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="muted small">Un élément déjà utilisé dans un match ne peut pas être supprimé (le nombre indique ses utilisations), mais tu peux le renommer.</p>
    </Sheet>
  )
}

function CustomFieldEditor({ field, onClose }: { field?: CustomField; onClose(): void }) {
  const { data, saveCustomField, deleteCustomField } = useStore()
  const [draft, setDraft] = useState<CustomField>(
    field ?? { id: uid('cf-'), label: '', type: 'select', scope: 'game', options: [] },
  )
  const [optionsText, setOptionsText] = useState(draft.options.join(', '))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const needsOptions = draft.type === 'select' || draft.type === 'tags'
  const used = field
    ? data.matches.filter((m) => m.custom[field.id] != null || m.games.some((g) => g.custom[field.id] != null)).length
    : 0
  const save = () => {
    const options = optionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!draft.label.trim()) return setError('Donne un nom au champ.')
    if (needsOptions && options.length < 2) return setError('Indique au moins 2 options, séparées par des virgules.')
    saveCustomField({ ...draft, label: draft.label.trim(), options: needsOptions ? options : [] })
    onClose()
  }
  return (
    <Sheet title={field ? 'Modifier le champ' : 'Nouveau champ'} onClose={onClose}>
      <Field label="Nom">
        <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Ex. Mulligan" />
      </Field>
      <span className="field-label">Saisi pour chaque</span>
      <Segmented<CustomFieldScope>
        value={draft.scope}
        options={[
          { value: 'game', label: 'Game' },
          { value: 'match', label: 'Match' },
        ]}
        onChange={(scope) => setDraft({ ...draft, scope })}
      />
      <span className="field-label">Type</span>
      <div className="chips">
        {FIELD_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`chip ${draft.type === t.value ? 'on' : ''}`}
            onClick={() => setDraft({ ...draft, type: t.value })}
            disabled={!!field && used > 0 && t.value !== field.type}
          >
            {t.label}
          </button>
        ))}
      </div>
      {needsOptions && (
        <Field label="Options (séparées par des virgules)">
          <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="0 carte, 1 carte, 2 cartes" />
        </Field>
      )}
      {field && used > 0 && <p className="muted small">Utilisé dans {used} matchs : le type ne peut plus changer.</p>}
      {error && <p className="error">{error}</p>}
      <button className="btn primary block" onClick={save}>
        Enregistrer
      </button>
      {field && (
        <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
          Supprimer le champ
        </button>
      )}
      {confirmDelete && field && (
        <Confirm
          title="Supprimer ce champ ?"
          message={used ? `Les valeurs saisies dans ${used} matchs ne seront plus affichées.` : 'Le champ n’est utilisé nulle part.'}
          confirmLabel="Supprimer"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteCustomField(field.id)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}
