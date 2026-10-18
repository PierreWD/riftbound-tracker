import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, CustomField, Deck, ListKey, Match, ReasonTag } from './schema'
import { loadData, requestPersistence, saveData } from './storage'
import { mergeData } from './backup'
import { slug, uid } from './ids'
import { DEFAULT_FILTERS, type Filters } from '../stats/filters'

interface Store {
  data: AppData
  filters: Filters
  setFilters(f: Filters): void
  saveMatch(m: Match): void
  deleteMatch(id: string): void
  saveDeck(d: Deck): void
  deleteDeck(id: string): void
  addListItem(key: ListKey, name: string, kind?: ReasonTag['kind']): string
  updateListItem(key: ListKey, id: string, patch: { name?: string; kind?: ReasonTag['kind'] }): void
  deleteListItem(key: ListKey, id: string): void
  saveCustomField(f: CustomField): void
  deleteCustomField(id: string): void
  replaceAll(d: AppData): void
  mergeIn(d: AppData): void
  markExported(): void
}

const Ctx = createContext<Store | null>(null)

const FILTERS_KEY = 'riftbound-filters'

function readFilters(): Filters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<Filters>(readFilters)
  const dataRef = useRef<AppData | null>(null)

  useEffect(() => {
    loadData()
      .then((d) => {
        dataRef.current = d
        setData(d)
      })
      .catch((e) => setError(String(e?.message ?? e)))
    requestPersistence()
  }, [])

  const update = useCallback((fn: (d: AppData) => AppData) => {
    const current = dataRef.current
    if (!current) return
    const next = fn(current)
    dataRef.current = next
    setData(next)
    saveData(next).catch((e) => setError(`Échec de la sauvegarde : ${e?.message ?? e}`))
  }, [])

  const store = useMemo<Store | null>(() => {
    if (!data) return null
    return {
      data,
      filters,
      setFilters(f) {
        setFiltersState(f)
        try {
          localStorage.setItem(FILTERS_KEY, JSON.stringify(f))
        } catch {
          /* stockage indisponible : pas grave */
        }
      },
      saveMatch(m) {
        const stamped = { ...m, updatedAt: new Date().toISOString() }
        update((d) => ({
          ...d,
          matches: d.matches.some((x) => x.id === m.id)
            ? d.matches.map((x) => (x.id === m.id ? stamped : x))
            : [...d.matches, stamped],
        }))
      },
      deleteMatch(id) {
        update((d) => ({ ...d, matches: d.matches.filter((m) => m.id !== id) }))
      },
      saveDeck(deck) {
        update((d) => ({
          ...d,
          decks: d.decks.some((x) => x.id === deck.id) ? d.decks.map((x) => (x.id === deck.id ? deck : x)) : [...d.decks, deck],
        }))
      },
      deleteDeck(id) {
        update((d) => ({ ...d, decks: d.decks.filter((x) => x.id !== id) }))
      },
      addListItem(key, name, kind) {
        const prefix = { legends: 'lg', battlefields: 'bf', tournamentTypes: 'tt', reasonTags: 'tag' }[key]
        const id = `${prefix}-${slug(name) || 'x'}-${uid().slice(0, 4)}`
        update((d) => ({
          ...d,
          [key]: [...d[key], key === 'reasonTags' ? { id, name, kind: kind ?? 'both' } : { id, name }],
        }))
        return id
      },
      updateListItem(key, id, patch) {
        update((d) => ({ ...d, [key]: (d[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },
      deleteListItem(key, id) {
        update((d) => ({ ...d, [key]: (d[key] as { id: string }[]).filter((x) => x.id !== id) }))
      },
      saveCustomField(f) {
        update((d) => ({
          ...d,
          customFields: d.customFields.some((x) => x.id === f.id)
            ? d.customFields.map((x) => (x.id === f.id ? f : x))
            : [...d.customFields, f],
        }))
      },
      deleteCustomField(id) {
        update((d) => ({ ...d, customFields: d.customFields.filter((x) => x.id !== id) }))
      },
      replaceAll(next) {
        update(() => next)
      },
      mergeIn(incoming) {
        update((d) => mergeData(d, incoming))
      },
      markExported() {
        update((d) => ({ ...d, meta: { ...d.meta, lastExportAt: new Date().toISOString() } }))
      },
    }
  }, [data, filters, update])

  if (error) return <div className="fatal">Erreur : {error}</div>
  if (!store) return <div className="loading">Chargement…</div>
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors StoreProvider')
  return s
}

/** Nombre de matchs qui utilisent un élément de liste (pour bloquer la suppression). */
export function usageCount(data: AppData, key: ListKey, id: string): number {
  switch (key) {
    case 'legends':
      return (
        data.matches.filter((m) => m.opponent.legendId === id).length + data.decks.filter((d) => d.legendId === id).length
      )
    case 'battlefields':
      return data.matches.filter((m) => m.games.some((g) => g.myBattlefieldId === id || g.oppBattlefieldId === id)).length
    case 'tournamentTypes':
      return data.matches.filter((m) => m.tournamentTypeId === id).length
    case 'reasonTags':
      return data.matches.filter((m) => m.reasonTagIds.includes(id) || m.games.some((g) => g.reasonTagIds.includes(id)))
        .length
  }
}
