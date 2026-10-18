import type { AppData, CustomField, CustomValue } from '../data/schema'
import { deckLabel, deckLegendId, nameOf } from '../data/matchUtils'
import type { Dimension, Row } from './engine'

const opt = (v: string | undefined | null): string[] => (v ? [v] : [])

function customKeys(field: CustomField, value: CustomValue | undefined): string[] {
  if (value == null || value === '') return []
  switch (field.type) {
    case 'boolean':
      return [value ? 'Oui' : 'Non']
    case 'tags':
      return Array.isArray(value) ? value : [String(value)]
    case 'text':
      return [String(value).trim()].filter(Boolean)
    default:
      return [String(value)]
  }
}

function marginBucket(row: Row): string[] {
  const g = row.game
  if (!g || g.myScore == null || g.oppScore == null) return []
  const diff = Math.abs(g.myScore - g.oppScore)
  if (diff <= 2) return ['close']
  if (diff <= 4) return ['mid']
  return ['wide']
}

const MARGIN_LABEL: Record<string, string> = {
  close: 'Serré (≤ 2 pts)',
  mid: 'Moyen (3-4 pts)',
  wide: 'Large (5+ pts)',
}

/**
 * Toutes les façons de découper les stats. Chaque champ personnalisé
 * devient automatiquement une dimension (préfixe ★).
 */
export function buildDimensions(data: AppData): Dimension[] {
  const identity = (k: string) => k
  const dims: Dimension[] = [
    {
      id: 'oppLegend',
      label: 'Légende adverse',
      level: 'match',
      keys: (r) => opt(r.match.opponent.legendId),
      labelOf: (k) => nameOf(data.legends, k),
    },
    {
      id: 'myDeck',
      label: 'Mon deck',
      level: 'match',
      keys: (r) => opt(r.match.myDeckId),
      labelOf: (k) => deckLabel(data, k),
    },
    {
      id: 'myLegend',
      label: 'Ma légende',
      level: 'match',
      keys: (r) => opt(deckLegendId(data, r.match.myDeckId)),
      labelOf: (k) => nameOf(data.legends, k),
    },
    {
      id: 'wentFirst',
      label: 'Premier / second',
      level: 'game',
      keys: (r) => (r.game?.iWentFirst == null ? [] : [r.game.iWentFirst ? 'first' : 'second']),
      labelOf: (k) => (k === 'first' ? 'Je commence' : 'Je suis second'),
      order: ['first', 'second'],
    },
    {
      id: 'gameIndex',
      label: 'Numéro de game',
      level: 'game',
      keys: (r) => (r.game ? [`G${r.game.index}`] : []),
      labelOf: (k) => (k === 'G1' ? 'G1 (avant side)' : `${k} (après side)`),
      order: ['G1', 'G2', 'G3'],
    },
    {
      id: 'myBattlefield',
      label: 'Mon battlefield',
      level: 'game',
      keys: (r) => opt(r.game?.myBattlefieldId),
      labelOf: (k) => nameOf(data.battlefields, k),
    },
    {
      id: 'oppBattlefield',
      label: 'Battlefield adverse',
      level: 'game',
      keys: (r) => opt(r.game?.oppBattlefieldId),
      labelOf: (k) => nameOf(data.battlefields, k),
    },
    {
      id: 'margin',
      label: 'Écart de score',
      level: 'game',
      keys: marginBucket,
      labelOf: (k) => MARGIN_LABEL[k] ?? k,
      order: ['close', 'mid', 'wide'],
    },
    {
      id: 'tournamentType',
      label: 'Type de tournoi',
      level: 'match',
      keys: (r) => opt(r.match.tournamentTypeId),
      labelOf: (k) => nameOf(data.tournamentTypes, k),
    },
    {
      id: 'tournamentName',
      label: 'Tournoi',
      level: 'match',
      keys: (r) => opt(r.match.tournamentName?.trim()),
      labelOf: identity,
    },
    {
      id: 'round',
      label: 'Ronde',
      level: 'match',
      keys: (r) => (r.match.round ? [String(r.match.round)] : []),
      labelOf: (k) => `Ronde ${k}`,
      order: Array.from({ length: 20 }, (_, i) => String(i + 1)),
    },
    {
      id: 'month',
      label: 'Mois',
      level: 'match',
      keys: (r) => [r.match.date.slice(0, 7)],
      labelOf: (k) => {
        const [y, m] = k.split('-').map(Number)
        return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      },
    },
    {
      id: 'opponentName',
      label: 'Adversaire',
      level: 'match',
      keys: (r) => opt(r.match.opponent.name?.trim()),
      labelOf: identity,
    },
    {
      id: 'tags',
      label: 'Tags de raison',
      level: 'match',
      keys: (r) =>
        r.game ? r.game.reasonTagIds : [...r.match.reasonTagIds, ...r.match.games.flatMap((g) => g.reasonTagIds)],
      labelOf: (k) => nameOf(data.reasonTags, k),
    },
  ]

  for (const field of data.customFields) {
    dims.push({
      id: `custom:${field.id}`,
      label: `★ ${field.label}`,
      level: field.scope,
      keys: (r) =>
        field.scope === 'game'
          ? r.game
            ? customKeys(field, r.game.custom[field.id])
            : []
          : customKeys(field, r.match.custom[field.id]),
      labelOf: identity,
      order:
        field.type === 'select' || field.type === 'tags'
          ? field.options
          : field.type === 'boolean'
            ? ['Oui', 'Non']
            : undefined,
    })
  }
  return dims
}

export function getDimension(data: AppData, id: string): Dimension {
  const dim = buildDimensions(data).find((d) => d.id === id)
  if (!dim) throw new Error(`Dimension inconnue : ${id}`)
  return dim
}
