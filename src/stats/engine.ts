import type { Game, Match, Outcome } from '../data/schema'

/** Une ligne d'analyse : un match entier, ou une game précise d'un match. */
export interface Row {
  match: Match
  game?: Game
}

export interface Tally {
  w: number
  l: number
  d: number
  n: number
  /** victoires / total (les nuls comptent comme non-victoires). null si n = 0 */
  winrate: number | null
  /** intervalle de confiance de Wilson à 95 % */
  low: number
  high: number
}

export const SMALL_SAMPLE = 5

export function wilson(w: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1]
  const p = w / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return [Math.max(0, center - half), Math.min(1, center + half)]
}

export function tally(outcomes: Outcome[]): Tally {
  let w = 0
  let l = 0
  let d = 0
  for (const o of outcomes) {
    if (o === 'W') w++
    else if (o === 'L') l++
    else d++
  }
  const n = w + l + d
  const [low, high] = wilson(w, n)
  return { w, l, d, n, winrate: n ? w / n : null, low, high }
}

export const outcomeOf = (row: Row): Outcome => (row.game ? row.game.result : row.match.result)

export const matchRows = (matches: Match[]): Row[] => matches.map((match) => ({ match }))

export const gameRows = (matches: Match[]): Row[] =>
  matches.flatMap((match) => match.games.map((game) => ({ match, game })))

export const tallyRows = (rows: Row[]): Tally => tally(rows.map(outcomeOf))

export interface Dimension {
  id: string
  label: string
  /** 'game' = n'a de sens qu'au niveau d'une game (ex. premier/second) */
  level: 'match' | 'game'
  keys(row: Row): string[]
  labelOf(key: string): string
  /** ordre d'affichage fixe (sinon tri par nombre de lignes) */
  order?: string[]
}

export interface BreakdownRow extends Tally {
  key: string
  label: string
}

export const NONE = '__none'

export function breakdown(rows: Row[], dim: Dimension): BreakdownRow[] {
  const groups = new Map<string, Outcome[]>()
  for (const row of rows) {
    let keys = dim.keys(row)
    if (keys.length === 0) keys = [NONE]
    for (const key of new Set(keys)) {
      const list = groups.get(key) ?? []
      list.push(outcomeOf(row))
      groups.set(key, list)
    }
  }
  const result = [...groups.entries()].map(([key, outs]) => ({
    key,
    label: key === NONE ? 'Non renseigné' : dim.labelOf(key),
    ...tally(outs),
  }))
  const noneLast = (a: BreakdownRow, b: BreakdownRow) => (a.key === NONE ? 1 : 0) - (b.key === NONE ? 1 : 0)
  if (dim.order) {
    const order = dim.order
    const idx = (k: string) => {
      const i = order.indexOf(k)
      return i === -1 ? 999 : i
    }
    return result.sort((a, b) => noneLast(a, b) || idx(a.key) - idx(b.key) || b.n - a.n)
  }
  return result.sort((a, b) => noneLast(a, b) || b.n - a.n || a.label.localeCompare(b.label))
}

/** Écart moyen de score (mon score - adverse) sur les games renseignées. */
export function averageMargin(rows: Row[]): { avg: number | null; n: number } {
  const margins = rows
    .map((r) => r.game)
    .filter((g): g is Game => !!g && g.myScore != null && g.oppScore != null)
    .map((g) => g.myScore! - g.oppScore!)
  if (!margins.length) return { avg: null, n: 0 }
  return { avg: margins.reduce((a, b) => a + b, 0) / margins.length, n: margins.length }
}

export interface TagCount {
  inWins: number
  inLosses: number
  inDraws: number
}

/** Compte des tags (match + games), séparés selon le résultat du match ou de la game concernée. */
export function tagCounts(matches: Match[]): Map<string, TagCount> {
  const counts = new Map<string, TagCount>()
  const add = (tagId: string, o: Outcome) => {
    const c = counts.get(tagId) ?? { inWins: 0, inLosses: 0, inDraws: 0 }
    if (o === 'W') c.inWins++
    else if (o === 'L') c.inLosses++
    else c.inDraws++
    counts.set(tagId, c)
  }
  for (const m of matches) {
    for (const t of m.reasonTagIds) add(t, m.result)
    for (const g of m.games) for (const t of g.reasonTagIds) add(t, g.result)
  }
  return counts
}

export interface RollingPoint {
  i: number
  date: string
  winrate: number
  cumulative: number
}

/** Winrate glissant sur les N derniers matchs, dans l'ordre chronologique. */
export function rollingWinrate(matchesAsc: Match[], window = 10): RollingPoint[] {
  const out: RollingPoint[] = []
  let wins = 0
  matchesAsc.forEach((m, i) => {
    if (m.result === 'W') wins++
    const slice = matchesAsc.slice(Math.max(0, i - window + 1), i + 1)
    const w = slice.filter((x) => x.result === 'W').length
    out.push({ i: i + 1, date: m.date, winrate: w / slice.length, cumulative: wins / (i + 1) })
  })
  return out
}

export const pct = (x: number | null | undefined, digits = 0): string =>
  x == null ? '—' : `${(x * 100).toFixed(digits)} %`

export const record = (t: Pick<Tally, 'w' | 'l' | 'd'>): string => (t.d ? `${t.w}-${t.l}-${t.d}` : `${t.w}-${t.l}`)
