import { describe, expect, it } from 'vitest'
import type { Game, Match } from '../data/schema'
import { createDefaultData } from '../data/defaults'
import { computeResult, gameScore } from '../data/matchUtils'
import { createDemoData } from '../data/demo'
import { averageMargin, breakdown, gameRows, matchRows, tally, tagCounts, wilson, NONE } from './engine'
import { buildDimensions, getDimension } from './dimensions'
import { applyFilters } from './filters'
import { computeInsights } from './insights'

const game = (index: number, result: Game['result'], iWentFirst?: boolean, extra: Partial<Game> = {}): Game => ({
  index,
  result,
  iWentFirst,
  reasonTagIds: [],
  custom: {},
  ...extra,
})

const match = (id: string, legendId: string, games: Game[], extra: Partial<Match> = {}): Match => ({
  id,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  date: '2026-01-01',
  tournamentTypeId: 'tt-nexus-night',
  myDeckId: 'd1',
  opponent: { legendId },
  games,
  result: computeResult(games),
  reasonTagIds: [],
  custom: {},
  ...extra,
})

describe('résultat Bo3', () => {
  it('calcule victoire, défaite, nul', () => {
    expect(computeResult([game(1, 'W'), game(2, 'L'), game(3, 'W')])).toBe('W')
    expect(computeResult([game(1, 'L'), game(2, 'L')])).toBe('L')
    expect(computeResult([game(1, 'W'), game(2, 'L')])).toBe('D')
    expect(computeResult([game(1, 'W')])).toBe('W') // Bo1
    expect(gameScore(match('m', 'x', [game(1, 'W'), game(2, 'L'), game(3, 'D')]))).toBe('1-1-1')
  })
})

describe('tally / wilson', () => {
  it('compte et calcule le winrate', () => {
    const t = tally(['W', 'W', 'L', 'D'])
    expect(t).toMatchObject({ w: 2, l: 1, d: 1, n: 4, winrate: 0.5 })
    expect(tally([]).winrate).toBeNull()
  })
  it('donne un intervalle large sur petit échantillon', () => {
    const [lo, hi] = wilson(1, 2)
    expect(lo).toBeLessThan(0.1)
    expect(hi).toBeGreaterThan(0.9)
    const [lo2, hi2] = wilson(50, 100)
    expect(hi2 - lo2).toBeLessThan(0.2)
  })
})

describe('breakdown', () => {
  const data = createDefaultData()
  const ms = [
    match('a', 'lg-jinx', [game(1, 'W', true), game(2, 'W', false)]),
    match('b', 'lg-jinx', [game(1, 'L', true), game(2, 'W', true), game(3, 'L', false)]),
    match('c', 'lg-viktor', [game(1, 'L', false), game(2, 'L', true)]),
  ]
  it('par légende adverse (niveau match)', () => {
    const rows = breakdown(matchRows(ms), getDimension(data, 'oppLegend'))
    expect(rows[0]).toMatchObject({ key: 'lg-jinx', label: 'Jinx', w: 1, l: 1, n: 2 })
    expect(rows[1]).toMatchObject({ key: 'lg-viktor', w: 0, l: 1 })
  })
  it('premier / second (niveau game)', () => {
    const rows = breakdown(gameRows(ms), getDimension(data, 'wentFirst'))
    expect(rows.map((r) => r.key)).toEqual(['first', 'second'])
    expect(rows[0]).toMatchObject({ w: 2, l: 2 })
    expect(rows[1]).toMatchObject({ w: 1, l: 2 })
  })
  it('range les valeurs manquantes en dernier', () => {
    const rows = breakdown(gameRows([match('d', 'lg-ahri', [game(1, 'W')])]), getDimension(data, 'myBattlefield'))
    expect(rows[0].key).toBe(NONE)
  })
  it('écart de score moyen', () => {
    const rows = gameRows([match('e', 'x', [game(1, 'W', true, { myScore: 8, oppScore: 6 }), game(2, 'L', true, { myScore: 4, oppScore: 8 })])])
    expect(averageMargin(rows)).toEqual({ avg: -1, n: 2 })
  })
})

describe('champs personnalisés', () => {
  it('deviennent des dimensions', () => {
    const data = createDefaultData()
    data.customFields = [{ id: 'cf1', label: 'Mulligan', type: 'select', scope: 'game', options: ['0', '1'] }]
    const ms = [match('a', 'x', [game(1, 'W', true, { custom: { cf1: '1' } }), game(2, 'L', true, { custom: { cf1: '0' } })])]
    const dim = buildDimensions(data).find((d) => d.id === 'custom:cf1')!
    expect(dim.level).toBe('game')
    const rows = breakdown(gameRows(ms), dim)
    expect(rows.map((r) => [r.key, r.w, r.l])).toEqual([
      ['0', 0, 1],
      ['1', 1, 0],
    ])
  })
})

describe('tags et filtres', () => {
  it('compte les tags selon le résultat', () => {
    const ms = [match('a', 'x', [game(1, 'L', true, { reasonTagIds: ['flood'] })], { reasonTagIds: ['flood'] })]
    expect(tagCounts(ms).get('flood')).toEqual({ inWins: 0, inLosses: 2, inDraws: 0 })
  })
  it('filtre par période et type', () => {
    const ms = [
      match('a', 'x', [game(1, 'W')], { date: '2026-10-01' }),
      match('b', 'x', [game(1, 'W')], { date: '2025-01-01', tournamentTypeId: 'tt-skirmish' }),
    ]
    const now = new Date('2026-10-18')
    expect(applyFilters(ms, { period: '30', tournamentTypeIds: [], myDeckIds: [] }, now).map((m) => m.id)).toEqual(['a'])
    expect(applyFilters(ms, { period: 'all', tournamentTypeIds: ['tt-skirmish'], myDeckIds: [] }, now).map((m) => m.id)).toEqual(['b'])
  })
})

describe('insights sur les données de démo', () => {
  it('produit des constats triés', () => {
    const data = createDemoData(new Date('2026-10-18'))
    expect(data.matches.length).toBeGreaterThan(30)
    const insights = computeInsights(data, data.matches)
    expect(insights.length).toBeGreaterThan(2)
    for (let i = 1; i < insights.length; i++) expect(insights[i - 1].score).toBeGreaterThanOrEqual(insights[i].score)
  })
})
