import type { AppData, Match } from '../data/schema'
import { nameOf, sortMatchesAsc } from '../data/matchUtils'
import { breakdown, gameRows, matchRows, pct, record, tagCounts, tally, tallyRows, type Row } from './engine'
import { getDimension } from './dimensions'

export type Tone = 'good' | 'bad' | 'info'

export interface Insight {
  tone: Tone
  text: string
  /** plus c'est haut, plus c'est important (écart × racine de l'échantillon) */
  score: number
  /** légende adverse concernée, pour ouvrir le détail du match-up */
  legendId?: string
}

const weight = (gap: number, n: number) => Math.abs(gap) * Math.sqrt(n)

function firstSecond(rows: Row[]) {
  const first = tallyRows(rows.filter((r) => r.game?.iWentFirst === true))
  const second = tallyRows(rows.filter((r) => r.game?.iWentFirst === false))
  return { first, second }
}

function g1VsPost(rows: Row[]) {
  const g1 = tallyRows(rows.filter((r) => r.game?.index === 1))
  const post = tallyRows(rows.filter((r) => (r.game?.index ?? 0) > 1))
  return { g1, post }
}

export function computeInsights(data: AppData, matches: Match[]): Insight[] {
  const out: Insight[] = []
  if (matches.length < 3) {
    return [{ tone: 'info', text: 'Saisis au moins 3 matchs pour voir apparaître des tendances.', score: 0 }]
  }
  const games = gameRows(matches)
  const legend = (id: string) => nameOf(data.legends, id)

  // 1. Meilleurs / pires match-ups
  const byOpp = breakdown(matchRows(matches), getDimension(data, 'oppLegend')).filter((r) => r.n >= 3 && r.key !== '__none')
  const sorted = [...byOpp].sort((a, b) => (a.winrate ?? 0) - (b.winrate ?? 0))
  for (const r of sorted.slice(0, 2)) {
    if ((r.winrate ?? 1) <= 0.4)
      out.push({
        tone: 'bad',
        text: `Match-up difficile : vs ${r.label} — ${record(r)} (${pct(r.winrate)})`,
        score: weight(0.5 - r.winrate!, r.n) + 0.5,
        legendId: r.key,
      })
  }
  for (const r of sorted.slice(-2).reverse()) {
    if ((r.winrate ?? 0) >= 0.6)
      out.push({
        tone: 'good',
        text: `Bon match-up : vs ${r.label} — ${record(r)} (${pct(r.winrate)})`,
        score: weight(r.winrate! - 0.5, r.n),
        legendId: r.key,
      })
  }

  // 2. Premier / second, global
  const fs = firstSecond(games)
  if (fs.first.n >= 4 && fs.second.n >= 4) {
    const gap = fs.first.winrate! - fs.second.winrate!
    if (Math.abs(gap) >= 0.15)
      out.push({
        tone: 'info',
        text: `Tu gagnes ${pct(fs.first.winrate)} de tes games quand tu commences, contre ${pct(fs.second.winrate)} quand tu es second.`,
        score: weight(gap, Math.min(fs.first.n, fs.second.n)),
      })
  }

  // 3. Premier / second par match-up
  for (const opp of byOpp.length ? byOpp : []) {
    const rows = games.filter((r) => r.match.opponent.legendId === opp.key)
    const s = firstSecond(rows)
    if (s.first.n >= 2 && s.second.n >= 2) {
      const gap = s.first.winrate! - s.second.winrate!
      if (Math.abs(gap) >= 0.35)
        out.push({
          tone: 'bad',
          text: `Vs ${legend(opp.key)} : ${pct(s.first.winrate)} en premier mais ${pct(s.second.winrate)} en second. ${gap > 0 ? 'Choisis de commencer quand tu peux.' : 'Laisse-le commencer quand tu peux.'}`,
          score: weight(gap, Math.min(s.first.n, s.second.n)),
          legendId: opp.key,
        })
    }
  }

  // 4. G1 vs après side
  const gp = g1VsPost(games)
  if (gp.g1.n >= 4 && gp.post.n >= 4) {
    const gap = gp.g1.winrate! - gp.post.winrate!
    if (gap >= 0.15)
      out.push({
        tone: 'bad',
        text: `Tu gagnes ${pct(gp.g1.winrate)} des G1 mais seulement ${pct(gp.post.winrate)} après side : ton side (ou celui de l'adversaire) pèse.`,
        score: weight(gap, Math.min(gp.g1.n, gp.post.n)),
      })
    else if (gap <= -0.15)
      out.push({
        tone: 'good',
        text: `Tes G2/G3 (${pct(gp.post.winrate)}) sont meilleures que tes G1 (${pct(gp.g1.winrate)}) : ton side fonctionne.`,
        score: weight(gap, Math.min(gp.g1.n, gp.post.n)),
      })
  }
  for (const opp of byOpp) {
    const s = g1VsPost(games.filter((r) => r.match.opponent.legendId === opp.key))
    if (s.g1.n >= 3 && s.post.n >= 3 && s.g1.winrate! - s.post.winrate! >= 0.4)
      out.push({
        tone: 'bad',
        text: `Vs ${legend(opp.key)} : ${pct(s.g1.winrate)} en G1, ${pct(s.post.winrate)} après side. Revois ton plan de side.`,
        score: weight(s.g1.winrate! - s.post.winrate!, Math.min(s.g1.n, s.post.n)),
        legendId: opp.key,
      })
  }

  // 5. Raisons des défaites
  const tags = [...tagCounts(matches).entries()]
    .map(([id, c]) => ({ id, ...c, tag: data.reasonTags.find((t) => t.id === id) }))
    .filter((t) => t.tag && t.tag.kind !== 'win')
    .sort((a, b) => b.inLosses - a.inLosses)
  if (tags[0] && tags[0].inLosses >= 2)
    out.push({
      tone: 'bad',
      text: `Raison n°1 de tes défaites : « ${tags[0].tag!.name} » (${tags[0].inLosses} fois).`,
      score: Math.sqrt(tags[0].inLosses) * 0.6,
    })

  // 6. Défaites serrées par match-up
  for (const opp of byOpp) {
    const lost = games.filter(
      (r) => r.match.opponent.legendId === opp.key && r.game!.result === 'L' && r.game!.myScore != null && r.game!.oppScore != null,
    )
    if (lost.length >= 2) {
      const avg = lost.reduce((s, r) => s + (r.game!.oppScore! - r.game!.myScore!), 0) / lost.length
      if (avg <= 2)
        out.push({
          tone: 'info',
          text: `Tes défaites vs ${legend(opp.key)} sont serrées (${avg.toFixed(1).replace('.', ',')} pt d'écart en moyenne) : le match-up est jouable.`,
          score: 0.4 * Math.sqrt(lost.length),
          legendId: opp.key,
        })
    }
  }

  // 7. Tendance récente
  if (matches.length >= 15) {
    const asc = sortMatchesAsc(matches)
    const last = tally(asc.slice(-10).map((m) => m.result))
    const all = tally(asc.map((m) => m.result))
    const gap = last.winrate! - all.winrate!
    if (Math.abs(gap) >= 0.15)
      out.push({
        tone: gap > 0 ? 'good' : 'bad',
        text: `Tes 10 derniers matchs : ${pct(last.winrate)}, contre ${pct(all.winrate)} au global. ${gap > 0 ? 'Tu progresses.' : 'Petite baisse de forme.'}`,
        score: weight(gap, 10),
      })
  }

  // 8. Decks comparés
  const byDeck = breakdown(matchRows(matches), getDimension(data, 'myDeck')).filter((r) => r.n >= 5)
  if (byDeck.length >= 2) {
    const s = [...byDeck].sort((a, b) => b.winrate! - a.winrate!)
    const best = s[0]
    const worst = s[s.length - 1]
    if (best.winrate! - worst.winrate! >= 0.2)
      out.push({
        tone: 'info',
        text: `Ton meilleur deck : ${best.label} (${pct(best.winrate)}), loin devant ${worst.label} (${pct(worst.winrate)}).`,
        score: weight(best.winrate! - worst.winrate!, Math.min(best.n, worst.n)),
      })
  }

  // 9. Battlefields
  for (const r of breakdown(games, getDimension(data, 'myBattlefield'))) {
    if (r.key === '__none' || r.n < 4) continue
    if (r.winrate! <= 0.3 || r.winrate! >= 0.7)
      out.push({
        tone: r.winrate! >= 0.7 ? 'good' : 'bad',
        text: `Avec ton battlefield « ${r.label} » : ${record(r)} en games (${pct(r.winrate)}).`,
        score: weight(r.winrate! - 0.5, r.n) * 0.8,
      })
  }

  return out.sort((a, b) => b.score - a.score)
}
