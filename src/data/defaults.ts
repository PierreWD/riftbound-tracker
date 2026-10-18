import type { AppData, NamedItem, ReasonTag, TagKind } from './schema'
import { slug } from './ids'

export const CURRENT_SCHEMA_VERSION = 1

// Légendes connues (Origins → Radiance). Modifiable dans Réglages.
const LEGEND_NAMES = [
  // Origins
  'Ahri', 'Annie', 'Darius', 'Garen', 'Jinx', "Kai'Sa", 'Lee Sin', 'Leona', 'Lux',
  'Master Yi', 'Miss Fortune', 'Sett', 'Teemo', 'Viktor', 'Volibear', 'Yasuo',
  // Spiritforged
  'Azir', 'Draven', 'Ezreal', 'Fiora', 'Irelia', 'Jax', 'Lucian', 'Ornn', "Rek'Sai",
  'Renata Glasc', 'Rumble', 'Sivir',
  // Unleashed
  'Diana', 'Ivern', 'Jhin', "Kha'Zix", 'LeBlanc', 'Lillia', 'Pyke', 'Rengar', 'Vex', 'Vi',
  // Vendetta
  'Akali', 'Ambessa', 'Jayce', 'Mel', 'Nasus', 'Renekton', 'Shen', 'Zed',
  // Radiance
  'Ekko', 'Evelynn', 'Jarvan IV', "K'Sante", 'Orianna', 'Seraphine', 'Ziggs',
]

const TOURNAMENT_TYPES = [
  'Pre-Rift',
  'Nexus Night',
  'Skirmish',
  'Regional Qualifier',
  'Regional',
  'National / Major',
  'Test / amical',
  'Autre',
]

const REASON_TAGS: [string, TagKind][] = [
  ['Bonne main de départ', 'win'],
  ['Courbe parfaite', 'win'],
  ['Bon contrôle des battlefields', 'win'],
  ['Adversaire flood/screw', 'win'],
  ['Erreur adverse', 'win'],
  ['Mauvais mulligan', 'loss'],
  ['Flood (trop de runes)', 'loss'],
  ['Screw (pas assez de runes)', 'loss'],
  ['Trop lent / tempo', 'loss'],
  ['Misplay', 'loss'],
  ['Carte clé adverse', 'loss'],
  ['Match-up défavorable', 'loss'],
  ['Pioche', 'both'],
  ['Course aux points', 'both'],
  ['Fin au temps', 'both'],
]

const named = (names: string[], prefix: string): NamedItem[] =>
  names.map((name) => ({ id: `${prefix}-${slug(name)}`, name }))

export function createDefaultData(): AppData {
  return {
    app: 'riftbound-tracker',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    legends: named(LEGEND_NAMES, 'lg'),
    battlefields: [],
    tournamentTypes: named(TOURNAMENT_TYPES, 'tt'),
    reasonTags: REASON_TAGS.map(([name, kind]): ReasonTag => ({ id: `tag-${slug(name)}`, name, kind })),
    decks: [],
    customFields: [],
    matches: [],
    meta: {},
  }
}
