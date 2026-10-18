import type { AppData, CustomField, CustomValues, Match, Outcome } from './schema'
import { deckLegendId, gameScore, nameOf, sortMatchesAsc } from './matchUtils'
import { breakdown, gameRows, matchRows, record, tagCounts, tallyRows, type BreakdownRow } from '../stats/engine'
import { getDimension } from '../stats/dimensions'

const RESULT: Record<Outcome, string> = { W: 'victoire', L: 'défaite', D: 'nul' }
const rate = (x: number | null) => (x == null ? null : Math.round(x * 100))

function customByLabel(fields: CustomField[], values: CustomValues): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const f of fields) if (values[f.id] != null && values[f.id] !== '') out[f.label] = values[f.id]
  return Object.keys(out).length ? out : undefined
}

const emptyToUndef = <T,>(arr: T[]): T[] | undefined => (arr.length ? arr : undefined)

function compactRow(r: BreakdownRow) {
  return { label: r.label, record: record(r), winratePct: rate(r.winrate), n: r.n }
}

export function buildAiExport(data: AppData, matchesInput: Match[] = data.matches) {
  const matches = sortMatchesAsc(matchesInput)
  const name = (list: { id: string; name: string }[], id?: string) => (id ? nameOf(list, id) : undefined)
  const tagNames = (ids: string[]) => emptyToUndef(ids.map((id) => nameOf(data.reasonTags, id)))
  const matchFields = data.customFields.filter((f) => f.scope === 'match')
  const gameFields = data.customFields.filter((f) => f.scope === 'game')

  const games = gameRows(matches)
  const first = tallyRows(games.filter((r) => r.game!.iWentFirst === true))
  const second = tallyRows(games.filter((r) => r.game!.iWentFirst === false))
  const matchTally = tallyRows(matchRows(matches))
  const gameTally = tallyRows(games)

  const byOpponentLegend = breakdown(matchRows(matches), getDimension(data, 'oppLegend')).map((r) => {
    const g = games.filter((x) => x.match.opponent.legendId === r.key)
    const f = tallyRows(g.filter((x) => x.game!.iWentFirst === true))
    const s = tallyRows(g.filter((x) => x.game!.iWentFirst === false))
    return {
      opponentLegend: r.label,
      matches: record(r),
      matchWinratePct: rate(r.winrate),
      games: record(tallyRows(g)),
      gameWinrateGoingFirstPct: f.n ? rate(f.winrate) : null,
      gameWinrateGoingSecondPct: s.n ? rate(s.winrate) : null,
    }
  })

  const tags = [...tagCounts(matches).entries()]
    .map(([id, c]) => ({ reason: nameOf(data.reasonTags, id), inWins: c.inWins, inLosses: c.inLosses, inDraws: c.inDraws }))
    .sort((a, b) => b.inLosses + b.inWins - (a.inLosses + a.inWins))

  return {
    format: 'riftbound-ai-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    instructions: {
      context:
        "Données de mes matchs de tournoi du jeu de cartes Riftbound (League of Legends TCG). Format Bo3 : un match = 1 à 3 games. " +
        "Chaque game se joue en 8 points ; 'wentFirst' indique si j'étais le premier joueur de la game. " +
        'Les G2/G3 se jouent après side (sideboard).',
      fieldGuide: {
        'matches[].myDeck': 'mon deck : légende, nom de version, commentaire général, et note propre à ce match',
        'matches[].opponent': "deck de l'adversaire : légende, nom/archétype, commentaire",
        'matches[].result': 'résultat du match (victoire / défaite / nul)',
        'matches[].score': 'score en games, de mon point de vue (ex. 2-1)',
        'matches[].reasons': 'tags expliquant le résultat du match',
        'matches[].games[]': 'détail de chaque game : premier/second, résultat, points, battlefields, tags, note',
        'matches[].custom': 'champs personnalisés que j’ai ajoutés (voir customFields)',
        summary: 'stats déjà calculées sur tous les matchs exportés (winrates en %)',
      },
      suggestedPrompt:
        "Analyse mes résultats Riftbound. Identifie mes bons et mauvais match-ups, l'impact d'être premier ou second, " +
        "les différences entre G1 et G2/G3 (side), les raisons récurrentes de mes défaites et ce que disent mes commentaires. " +
        "Donne-moi des conseils concrets pour progresser, en signalant quand l'échantillon est trop petit pour conclure.",
    },
    summary: {
      matchCount: matches.length,
      period: matches.length ? { from: matches[0].date, to: matches[matches.length - 1].date } : null,
      matchRecord: record(matchTally),
      matchWinratePct: rate(matchTally.winrate),
      gameRecord: record(gameTally),
      gameWinratePct: rate(gameTally.winrate),
      goingFirst: { games: record(first), winratePct: rate(first.winrate) },
      goingSecond: { games: record(second), winratePct: rate(second.winrate) },
      byOpponentLegend,
      byMyDeck: breakdown(matchRows(matches), getDimension(data, 'myDeck')).map(compactRow),
      byGameNumber: breakdown(games, getDimension(data, 'gameIndex')).map(compactRow),
      byTournamentType: breakdown(matchRows(matches), getDimension(data, 'tournamentType')).map(compactRow),
      reasons: tags,
    },
    myDecks: data.decks.map((d) => ({
      legend: nameOf(data.legends, d.legendId),
      name: d.name || undefined,
      comment: d.comment || undefined,
      archived: d.archived || undefined,
    })),
    customFields: emptyToUndef(
      data.customFields.map((f) => ({ label: f.label, type: f.type, scope: f.scope, options: emptyToUndef(f.options) })),
    ),
    matches: matches.map((m) => {
      const deck = data.decks.find((d) => d.id === m.myDeckId)
      return {
        date: m.date,
        tournament: {
          type: name(data.tournamentTypes, m.tournamentTypeId),
          name: m.tournamentName || undefined,
          round: m.round,
        },
        myDeck: {
          legend: name(data.legends, deckLegendId(data, m.myDeckId)),
          name: deck?.name || undefined,
          comment: deck?.comment || undefined,
          noteForThisMatch: m.myDeckNote || undefined,
        },
        opponent: {
          name: m.opponent.name || undefined,
          legend: name(data.legends, m.opponent.legendId),
          deck: m.opponent.deckName || undefined,
          comment: m.opponent.comment || undefined,
        },
        result: RESULT[m.result],
        score: gameScore(m),
        reasons: tagNames(m.reasonTagIds),
        comment: m.comment || undefined,
        custom: customByLabel(matchFields, m.custom),
        games: m.games.map((g) => ({
          game: g.index,
          wentFirst: g.iWentFirst ?? null,
          result: RESULT[g.result],
          points: g.myScore != null || g.oppScore != null ? `${g.myScore ?? '?'}-${g.oppScore ?? '?'}` : undefined,
          myBattlefield: name(data.battlefields, g.myBattlefieldId),
          oppBattlefield: name(data.battlefields, g.oppBattlefieldId),
          reasons: tagNames(g.reasonTagIds),
          note: g.note || undefined,
          custom: customByLabel(gameFields, g.custom),
        })),
      }
    }),
  }
}

export function serializeAiExport(data: AppData, matches?: Match[]): string {
  return JSON.stringify(buildAiExport(data, matches), null, 2)
}
