import type { Game, Outcome } from '../data/schema'
import { uid } from '../data/ids'

/** Score de victoire d'une game de Riftbound. */
export const VICTORY_SCORE = 8

export interface LiveGame {
  index: number
  iWentFirst?: boolean
  myScore: number
  oppScore: number
  result?: Outcome
  startedAt?: number // ms
  endedAt?: number // ms
}

export interface RoundTimer {
  /** durée de la ronde en minutes */
  minutes: number
  /** temps déjà écoulé lors des périodes précédentes (ms) */
  accumulatedMs: number
  /** début de la période en cours ; absent = en pause / pas lancé */
  runningSince?: number
}

export type LivePhase = 'setup' | 'toss' | 'playing' | 'between' | 'done'

export interface LiveMatch {
  id: string
  createdAt: string
  phase: LivePhase
  myDeckId: string
  oppLegendId: string
  oppName?: string
  /** affiche le côté adverse à l'envers, pour qu'il le lise en face */
  facing: boolean
  timer: RoundTimer
  games: LiveGame[]
  /** dernier résultat du toss : true = je commence */
  toss?: boolean
}

export function newLiveMatch(defaults: { myDeckId?: string; minutes?: number; facing?: boolean } = {}): LiveMatch {
  return {
    id: uid('live-'),
    createdAt: new Date().toISOString(),
    phase: 'setup',
    myDeckId: defaults.myDeckId ?? '',
    oppLegendId: '',
    facing: defaults.facing ?? false,
    timer: { minutes: defaults.minutes ?? 50, accumulatedMs: 0 },
    games: [],
  }
}

// ---------- Timer ----------

export function elapsedMs(t: RoundTimer, now = Date.now()): number {
  return t.accumulatedMs + (t.runningSince != null ? now - t.runningSince : 0)
}

/** Temps restant en ms (négatif = dépassement). */
export function remainingMs(t: RoundTimer, now = Date.now()): number {
  return t.minutes * 60_000 - elapsedMs(t, now)
}

export const isRunning = (t: RoundTimer) => t.runningSince != null

export function startTimer(t: RoundTimer, now = Date.now()): RoundTimer {
  return t.runningSince != null ? t : { ...t, runningSince: now }
}

export function pauseTimer(t: RoundTimer, now = Date.now()): RoundTimer {
  if (t.runningSince == null) return t
  return { ...t, accumulatedMs: t.accumulatedMs + (now - t.runningSince), runningSince: undefined }
}

export function formatClock(ms: number): string {
  const neg = ms < 0
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
  return `${neg ? '+' : ''}${h ? `${h}:` : ''}${mmss}`
}

// ---------- Games ----------

export const currentGame = (m: LiveMatch): LiveGame | undefined => m.games.find((g) => !g.result)

export function gameWins(m: LiveMatch): { me: number; opp: number } {
  return {
    me: m.games.filter((g) => g.result === 'W').length,
    opp: m.games.filter((g) => g.result === 'L').length,
  }
}

/** Le match est-il plié (2 games gagnées par l'un des deux, ou 3 games jouées) ? */
export function matchDecided(m: LiveMatch): boolean {
  const w = gameWins(m)
  return w.me >= 2 || w.opp >= 2 || m.games.filter((g) => g.result).length >= 3
}

/** Démarre une nouvelle game. Par défaut, le perdant de la game précédente commence. */
export function startGame(m: LiveMatch, iWentFirst?: boolean, now = Date.now()): LiveMatch {
  const prev = m.games[m.games.length - 1]
  const defaultFirst =
    iWentFirst ?? (prev?.result === 'L' ? true : prev?.result === 'W' ? false : prev?.iWentFirst)
  const game: LiveGame = { index: m.games.length + 1, iWentFirst: defaultFirst, myScore: 0, oppScore: 0, startedAt: now }
  return { ...m, phase: 'playing', games: [...m.games, game], timer: startTimer(m.timer, now) }
}

export function setScore(m: LiveMatch, side: 'me' | 'opp', delta: number): LiveMatch {
  const cur = currentGame(m)
  if (!cur) return m
  const key = side === 'me' ? 'myScore' : 'oppScore'
  const next = { ...cur, [key]: Math.max(0, cur[key] + delta) }
  return { ...m, games: m.games.map((g) => (g.index === cur.index ? next : g)) }
}

export function setFirst(m: LiveMatch, iWentFirst: boolean): LiveMatch {
  const cur = currentGame(m)
  if (!cur) return m
  return { ...m, games: m.games.map((g) => (g.index === cur.index ? { ...g, iWentFirst } : g)) }
}

/** Qui a atteint le score de victoire sur la game en cours ? */
export function suggestedResult(g: LiveGame | undefined): Outcome | undefined {
  if (!g) return undefined
  if (g.myScore >= VICTORY_SCORE && g.myScore > g.oppScore) return 'W'
  if (g.oppScore >= VICTORY_SCORE && g.oppScore > g.myScore) return 'L'
  return undefined
}

/** Clôt la game en cours avec le résultat choisi. */
export function finishGame(m: LiveMatch, result: Outcome, now = Date.now()): LiveMatch {
  const cur = currentGame(m)
  if (!cur) return m
  const games = m.games.map((g) => (g.index === cur.index ? { ...g, result, endedAt: now } : g))
  const next = { ...m, games }
  return matchDecided(next)
    ? { ...next, phase: 'done', timer: pauseTimer(m.timer, now) }
    : { ...next, phase: 'between' }
}

/** Annule la fin de la dernière game (erreur de clic). */
export function reopenLastGame(m: LiveMatch): LiveMatch {
  const last = m.games[m.games.length - 1]
  if (!last?.result) return m
  const games = m.games.map((g) => (g.index === last.index ? { ...g, result: undefined, endedAt: undefined } : g))
  return { ...m, games, phase: 'playing' }
}

/** Arrête le match avant la fin (temps écoulé, Bo1…). La game en cours non finie est ignorée. */
export function endMatch(m: LiveMatch, now = Date.now()): LiveMatch {
  return { ...m, phase: 'done', games: m.games.filter((g) => g.result), timer: pauseTimer(m.timer, now) }
}

export function coinToss(random = Math.random): boolean {
  return random() < 0.5
}

/** Données à injecter dans le formulaire de match. */
export interface MatchPrefill {
  myDeckId: string
  opponent: { legendId: string; name?: string }
  games: Game[]
}

export function toPrefill(m: LiveMatch): MatchPrefill {
  return {
    myDeckId: m.myDeckId,
    opponent: { legendId: m.oppLegendId, name: m.oppName?.trim() || undefined },
    games: m.games
      .filter((g): g is LiveGame & { result: Outcome } => !!g.result)
      .map((g) => ({
        index: g.index,
        iWentFirst: g.iWentFirst,
        result: g.result,
        myScore: g.myScore,
        oppScore: g.oppScore,
        durationSec: g.startedAt != null && g.endedAt != null ? Math.round((g.endedAt - g.startedAt) / 1000) : undefined,
        reasonTagIds: [],
        custom: {},
      })),
  }
}

// ---------- Persistance (localStorage : survit à la mise en veille / fermeture) ----------

const LIVE_KEY = 'riftbound-live'
const PREFILL_KEY = 'riftbound-prefill'
const PREFS_KEY = 'riftbound-live-prefs'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible */
  }
}

export const loadLive = () => read<LiveMatch>(LIVE_KEY)
export const saveLive = (m: LiveMatch | null) => write(LIVE_KEY, m)

export const loadPrefs = () => read<{ minutes: number; facing: boolean }>(PREFS_KEY)
export const savePrefs = (p: { minutes: number; facing: boolean }) => write(PREFS_KEY, p)

export const readPrefill = () => read<MatchPrefill>(PREFILL_KEY)
export const writePrefill = (p: MatchPrefill | null) => write(PREFILL_KEY, p)
