import type { AppData, Game, Match, Outcome } from './schema'

export function computeResult(games: Game[]): Outcome {
  const w = games.filter((g) => g.result === 'W').length
  const l = games.filter((g) => g.result === 'L').length
  if (w > l) return 'W'
  if (l > w) return 'L'
  return 'D'
}

export function gameScore(match: Match): string {
  const w = match.games.filter((g) => g.result === 'W').length
  const l = match.games.filter((g) => g.result === 'L').length
  const d = match.games.filter((g) => g.result === 'D').length
  return d ? `${w}-${l}-${d}` : `${w}-${l}`
}

export function nameOf(list: { id: string; name: string }[], id?: string): string {
  if (!id) return '—'
  return list.find((x) => x.id === id)?.name ?? '?'
}

export function deckLabel(data: AppData, deckId?: string): string {
  const deck = data.decks.find((d) => d.id === deckId)
  if (!deck) return '?'
  const legend = nameOf(data.legends, deck.legendId)
  return deck.name ? `${legend} · ${deck.name}` : legend
}

export function deckLegendId(data: AppData, deckId?: string): string | undefined {
  return data.decks.find((d) => d.id === deckId)?.legendId
}

/** Tri le plus récent d'abord (date puis ronde puis création). */
export function sortMatchesDesc(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.round ?? 0) - (a.round ?? 0) ||
      b.createdAt.localeCompare(a.createdAt),
  )
}

export function sortMatchesAsc(matches: Match[]): Match[] {
  return sortMatchesDesc(matches).reverse()
}

export const OUTCOME_LABEL: Record<Outcome, string> = { W: 'Victoire', L: 'Défaite', D: 'Nul' }
