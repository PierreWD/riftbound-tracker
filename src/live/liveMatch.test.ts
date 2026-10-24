import { describe, expect, it } from 'vitest'
import {
  coinToss,
  elapsedMs,
  endMatch,
  finishGame,
  formatClock,
  newLiveMatch,
  pauseTimer,
  remainingMs,
  reopenLastGame,
  setScore,
  startGame,
  startTimer,
  suggestedResult,
  toPrefill,
  currentGame,
} from './liveMatch'

const base = () => ({ ...newLiveMatch({ myDeckId: 'd1' }), oppLegendId: 'lg-viktor', oppName: ' Sam ' })

describe('timer', () => {
  it('compte le temps en tenant compte des pauses', () => {
    let t = { minutes: 50, accumulatedMs: 0 } as ReturnType<typeof newLiveMatch>['timer']
    t = startTimer(t, 1000)
    expect(elapsedMs(t, 61_000)).toBe(60_000)
    t = pauseTimer(t, 61_000)
    expect(elapsedMs(t, 999_999)).toBe(60_000)
    t = startTimer(t, 100_000)
    expect(remainingMs(t, 160_000)).toBe(50 * 60_000 - 120_000)
  })
  it('formate le temps et le dépassement', () => {
    expect(formatClock(50 * 60_000)).toBe('50:00')
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(-125_000)).toBe('+2:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })
})

describe('déroulé d’un Bo3', () => {
  it('enchaîne les games et le perdant commence la suivante', () => {
    let m = startGame(base(), true, 0)
    expect(m.phase).toBe('playing')
    expect(currentGame(m)?.iWentFirst).toBe(true)
    for (let i = 0; i < 8; i++) m = setScore(m, 'me', 1)
    m = setScore(m, 'opp', 5)
    m = setScore(m, 'opp', -10) // jamais négatif
    expect(currentGame(m)).toMatchObject({ myScore: 8, oppScore: 0 })
    expect(suggestedResult(currentGame(m))).toBe('W')
    m = finishGame(m, 'W', 600_000)
    expect(m.phase).toBe('between')

    m = startGame(m, undefined, 700_000)
    expect(currentGame(m)?.iWentFirst).toBe(false) // j'ai gagné, l'adversaire commence
    m = finishGame(m, 'L', 1_300_000)
    m = startGame(m, undefined, 1_400_000)
    expect(currentGame(m)?.iWentFirst).toBe(true) // j'ai perdu, je commence
    m = finishGame(m, 'W', 2_000_000)
    expect(m.phase).toBe('done')
    expect(m.timer.runningSince).toBeUndefined() // le timer s'arrête avec le match
    expect(elapsedMs(m.timer, 9_999_999)).toBe(2_000_000)

    const p = toPrefill(m)
    expect(p.opponent).toEqual({ legendId: 'lg-viktor', name: 'Sam' })
    expect(p.games.map((g) => [g.index, g.result, g.iWentFirst])).toEqual([
      [1, 'W', true],
      [2, 'L', false],
      [3, 'W', true],
    ])
    expect(p.games[0]).toMatchObject({ myScore: 8, oppScore: 0, durationSec: 600 })
  })

  it('2-0 termine le match', () => {
    let m = finishGame(startGame(base(), false), 'W')
    m = finishGame(startGame(m), 'W')
    expect(m.phase).toBe('done')
  })

  it('annule une fin de game par erreur', () => {
    const m = reopenLastGame(finishGame(startGame(base(), true), 'L'))
    expect(m.phase).toBe('playing')
    expect(currentGame(m)?.result).toBeUndefined()
  })

  it('arrêt anticipé : ignore la game en cours', () => {
    let m = finishGame(startGame(base(), true), 'W')
    m = startGame(m)
    m = endMatch(setScore(m, 'opp', 3))
    expect(m.phase).toBe('done')
    expect(toPrefill(m).games).toHaveLength(1)
  })
})

describe('toss', () => {
  it('suit le générateur aléatoire', () => {
    expect(coinToss(() => 0.1)).toBe(true)
    expect(coinToss(() => 0.9)).toBe(false)
  })
})
