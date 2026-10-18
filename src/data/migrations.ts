import type { AppData } from './schema'
import { CURRENT_SCHEMA_VERSION, createDefaultData } from './defaults'

// Chaque migration transforme la version N en N+1.
// Exemple pour plus tard : 1: (d) => ({ ...d, schemaVersion: 2, nouveauChamp: [] })
const MIGRATIONS: Record<number, (d: any) => any> = {}

export class ImportError extends Error {}

/** Vérifie qu'un objet ressemble à une sauvegarde de l'appli et le met à jour. */
export function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new ImportError("Ce fichier n'est pas un JSON valide.")
  const obj = raw as Record<string, unknown>
  if (obj.format === 'riftbound-ai-export')
    throw new ImportError("Ce fichier est un export « pour IA ». Pour restaurer tes données, importe un fichier « Sauvegarde ».")
  if (obj.app !== 'riftbound-tracker' || typeof obj.schemaVersion !== 'number')
    throw new ImportError("Ce fichier n'est pas une sauvegarde Riftbound Tracker.")
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION)
    throw new ImportError('Cette sauvegarde vient d’une version plus récente de l’appli. Mets l’appli à jour.')

  let data: any = obj
  while (data.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[data.schemaVersion]
    if (!step) throw new ImportError(`Migration manquante depuis la version ${data.schemaVersion}.`)
    data = step(data)
  }
  return normalize(data)
}

/** Complète les champs manquants pour éviter les plantages sur des données partielles. */
function normalize(d: any): AppData {
  const base = createDefaultData()
  const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
  return {
    app: 'riftbound-tracker',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    legends: arr(d.legends, base.legends),
    battlefields: arr(d.battlefields, []),
    tournamentTypes: arr(d.tournamentTypes, base.tournamentTypes),
    reasonTags: arr(d.reasonTags, base.reasonTags),
    decks: arr<any>(d.decks, []).map((k) => ({ comment: '', archived: false, name: '', ...k })),
    customFields: arr<any>(d.customFields, []).map((f) => ({ options: [], ...f })),
    matches: arr<any>(d.matches, []).map((m) => ({
      reasonTagIds: [],
      custom: {},
      updatedAt: m.createdAt ?? new Date(0).toISOString(),
      ...m,
      opponent: { legendId: '', ...(m.opponent ?? {}) },
      games: arr<any>(m.games, []).map((g) => ({ reasonTagIds: [], custom: {}, ...g })),
    })),
    meta: d.meta && typeof d.meta === 'object' ? d.meta : {},
  }
}
