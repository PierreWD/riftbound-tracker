import type { AppData } from './schema'
import { migrate } from './migrations'

export function serializeBackup(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function parseBackup(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return migrate(null)
  }
  return migrate(raw)
}

function unionById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((x) => [x.id, x]))
  for (const item of incoming) if (!map.has(item.id)) map.set(item.id, item)
  return [...map.values()]
}

/**
 * Fusionne une sauvegarde importée dans les données actuelles.
 * Listes : on garde l'existant et on ajoute les nouveaux éléments.
 * Matchs : à id égal, la version modifiée le plus récemment gagne.
 */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const matches = new Map(current.matches.map((m) => [m.id, m]))
  for (const m of incoming.matches) {
    const existing = matches.get(m.id)
    if (!existing || m.updatedAt > existing.updatedAt) matches.set(m.id, m)
  }
  return {
    ...current,
    legends: unionById(current.legends, incoming.legends),
    battlefields: unionById(current.battlefields, incoming.battlefields),
    tournamentTypes: unionById(current.tournamentTypes, incoming.tournamentTypes),
    reasonTags: unionById(current.reasonTags, incoming.reasonTags),
    decks: unionById(current.decks, incoming.decks),
    customFields: unionById(current.customFields, incoming.customFields),
    matches: [...matches.values()],
  }
}

export function backupSummary(data: AppData): { matches: number; from?: string; to?: string } {
  const dates = data.matches.map((m) => m.date).sort()
  return { matches: data.matches.length, from: dates[0], to: dates[dates.length - 1] }
}
