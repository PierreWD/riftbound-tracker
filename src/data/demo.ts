import type { AppData, Game, Match, Outcome } from './schema'
import { createDefaultData } from './defaults'
import { computeResult } from './matchUtils'

/** Générateur pseudo-aléatoire déterministe (mêmes données à chaque fois). */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Données d'exemple pour découvrir l'appli. Remplace toutes les données. */
export function createDemoData(today = new Date()): AppData {
  const data = createDefaultData()
  const rand = rng(42)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
  const L = (name: string) => data.legends.find((l) => l.name === name)!.id

  data.battlefields = ['Battlefield démo 1', 'Battlefield démo 2', 'Battlefield démo 3', 'Battlefield démo 4'].map((name, i) => ({
    id: `bf-demo-${i + 1}`,
    name,
  }))
  data.decks = [
    { id: 'deck-demo-1', legendId: L('Jinx'), name: 'Aggro v1', comment: 'Liste agressive, peu de réponses.', archived: false },
    { id: 'deck-demo-2', legendId: L('Jinx'), name: 'Aggro v2', comment: '+2 removal, -2 unités chères.', archived: false },
    { id: 'deck-demo-3', legendId: L('Viktor'), name: 'Contrôle', comment: '', archived: false },
  ]
  data.customFields = [
    { id: 'cf-demo-mull', label: 'Mulligan', type: 'select', scope: 'game', options: ['0 carte', '1 carte', '2 cartes'] },
  ]

  // probabilité de gagner une game selon la légende adverse (+ bonus si je commence)
  const opponents: [string, number][] = [
    ['Viktor', 0.35],
    ['Kai\'Sa', 0.62],
    ['Garen', 0.7],
    ['Annie', 0.45],
    ['Ahri', 0.55],
    ['Azir', 0.3],
    ['Draven', 0.6],
    ['Irelia', 0.5],
  ]
  const tagsLoss = ['tag-mauvais-mulligan', 'tag-flood-trop-de-runes', 'tag-trop-lent-tempo', 'tag-misplay', 'tag-carte-cle-adverse']
  const tagsWin = ['tag-bonne-main-de-depart', 'tag-courbe-parfaite', 'tag-bon-controle-des-battlefields']
  const tt = ['tt-nexus-night', 'tt-nexus-night', 'tt-skirmish', 'tt-regional-qualifier', 'tt-pre-rift']
  const names = ['Alex', 'Sam', 'Lucas', 'Emma', 'Hugo', 'Léa', 'Noah', 'Inès', 'Théo', 'Chloé']

  const matches: Match[] = []
  for (let event = 0; event < 12; event++) {
    const day = new Date(today)
    day.setDate(day.getDate() - (12 - event) * 9)
    const date = day.toISOString().slice(0, 10)
    const tournamentTypeId = pick(tt)
    const myDeckId = event < 4 ? 'deck-demo-1' : event < 9 ? 'deck-demo-2' : 'deck-demo-3'
    const rounds = tournamentTypeId === 'tt-nexus-night' ? 3 : 5
    for (let round = 1; round <= rounds; round++) {
      const [oppName, base] = pick(opponents)
      const deckBonus = myDeckId === 'deck-demo-2' ? 0.05 : myDeckId === 'deck-demo-3' ? -0.05 : 0
      const games: Game[] = []
      let iWentFirst = rand() < 0.5
      while (games.length < 3) {
        const p = base + deckBonus + (iWentFirst ? 0.12 : -0.12) - (games.length > 0 ? 0.05 : 0)
        const result: Outcome = rand() < p ? 'W' : 'L'
        const close = rand() < 0.4
        const loserScore = close ? 6 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 4)
        games.push({
          index: games.length + 1,
          iWentFirst,
          result,
          myScore: result === 'W' ? 8 : loserScore,
          oppScore: result === 'W' ? loserScore : 8,
          myBattlefieldId: pick(data.battlefields).id,
          oppBattlefieldId: pick(data.battlefields).id,
          reasonTagIds: rand() < 0.6 ? [result === 'W' ? pick(tagsWin) : pick(tagsLoss)] : [],
          custom: rand() < 0.5 ? { 'cf-demo-mull': pick(['0 carte', '1 carte', '2 cartes']) } : {},
        })
        const w = games.filter((g) => g.result === 'W').length
        const l = games.length - w
        if (w === 2 || l === 2) break
        iWentFirst = result === 'L' // le perdant choisit généralement de commencer
      }
      const result = computeResult(games)
      const iso = `${date}T1${round}:00:00.000Z`
      matches.push({
        id: `demo-${event}-${round}`,
        createdAt: iso,
        updatedAt: iso,
        date,
        tournamentTypeId,
        tournamentName: `Démo #${event + 1}`,
        round,
        myDeckId,
        opponent: {
          name: pick(names),
          legendId: L(oppName),
          deckName: pick(['', 'Aggro', 'Midrange', 'Contrôle']),
        },
        games,
        result,
        reasonTagIds: [],
        comment:
          result === 'L' && rand() < 0.5
            ? pick(['Je garde une main trop lente.', 'Il pose sa carte clé tour 3, je n’ai pas de réponse.', 'Erreur de calcul sur le dernier tour.'])
            : undefined,
        custom: {},
      })
    }
  }
  data.matches = matches
  return data
}
