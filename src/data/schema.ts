// Modèle de données de l'appli. Tout est stocké dans un seul document AppData.
// Pour ajouter un champ plus tard : soit un champ personnalisé (Réglages),
// soit un nouveau champ ici + une migration dans migrations.ts.

export type Outcome = 'W' | 'L' | 'D'

export interface NamedItem {
  id: string
  name: string
}

export type TagKind = 'win' | 'loss' | 'both'

export interface ReasonTag extends NamedItem {
  kind: TagKind
}

export interface Deck {
  id: string
  legendId: string
  name: string
  comment: string
  archived: boolean
}

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'select' | 'tags'
export type CustomFieldScope = 'match' | 'game'

export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
  scope: CustomFieldScope
  options: string[] // pour select / tags
}

export type CustomValue = string | number | boolean | string[]
export type CustomValues = Record<string, CustomValue>

export interface Game {
  index: number // 1, 2, 3
  iWentFirst?: boolean // undefined = non renseigné
  result: Outcome
  myScore?: number
  oppScore?: number
  myBattlefieldId?: string
  oppBattlefieldId?: string
  /** durée de la game en secondes (renseignée par le compagnon de partie) */
  durationSec?: number
  reasonTagIds: string[]
  note?: string
  custom: CustomValues
}

export interface Opponent {
  name?: string
  legendId: string
  deckName?: string
  comment?: string
}

export interface Match {
  id: string
  createdAt: string // ISO
  updatedAt: string // ISO, sert à la fusion lors d'un import
  date: string // YYYY-MM-DD
  tournamentTypeId: string
  tournamentName?: string
  round?: number
  myDeckId: string
  myDeckNote?: string
  opponent: Opponent
  games: Game[]
  result: Outcome // calculé à partir des games
  reasonTagIds: string[]
  comment?: string
  custom: CustomValues
}

export interface AppData {
  app: 'riftbound-tracker'
  schemaVersion: number
  legends: NamedItem[]
  battlefields: NamedItem[]
  tournamentTypes: NamedItem[]
  reasonTags: ReasonTag[]
  decks: Deck[]
  customFields: CustomField[]
  matches: Match[]
  meta: { lastExportAt?: string }
}

export type ListKey = 'legends' | 'battlefields' | 'tournamentTypes' | 'reasonTags'
