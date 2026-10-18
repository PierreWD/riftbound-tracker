import type { AppData, Match } from '../data/schema'

export type Period = 'all' | '30' | '90' | '365' | 'year'

export interface Filters {
  period: Period
  tournamentTypeIds: string[]
  myDeckIds: string[]
}

export const DEFAULT_FILTERS: Filters = { period: 'all', tournamentTypeIds: [], myDeckIds: [] }

export const PERIOD_LABEL: Record<Period, string> = {
  all: 'Tout',
  '30': '30 jours',
  '90': '90 jours',
  '365': '12 mois',
  year: 'Cette année',
}

function periodStart(period: Period, now: Date): string | null {
  if (period === 'all') return null
  if (period === 'year') return `${now.getFullYear()}-01-01`
  const d = new Date(now)
  d.setDate(d.getDate() - Number(period))
  return d.toISOString().slice(0, 10)
}

export function applyFilters(matches: Match[], f: Filters, now = new Date()): Match[] {
  const start = periodStart(f.period, now)
  return matches.filter(
    (m) =>
      (!start || m.date >= start) &&
      (!f.tournamentTypeIds.length || f.tournamentTypeIds.includes(m.tournamentTypeId)) &&
      (!f.myDeckIds.length || f.myDeckIds.includes(m.myDeckId)),
  )
}

export function filtersActive(f: Filters): boolean {
  return f.period !== 'all' || f.tournamentTypeIds.length > 0 || f.myDeckIds.length > 0
}

export function filtersSummary(data: AppData, f: Filters): string {
  const parts: string[] = []
  if (f.period !== 'all') parts.push(PERIOD_LABEL[f.period])
  if (f.tournamentTypeIds.length)
    parts.push(f.tournamentTypeIds.map((id) => data.tournamentTypes.find((t) => t.id === id)?.name ?? '?').join(', '))
  if (f.myDeckIds.length) parts.push(`${f.myDeckIds.length} deck${f.myDeckIds.length > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : 'Tous les matchs'
}
