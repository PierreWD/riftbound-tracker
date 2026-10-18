import { describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { createDemoData } from './demo'
import { mergeData, parseBackup, serializeBackup } from './backup'
import { serializeAiExport } from './aiExport'
import { ImportError } from './migrations'

describe('sauvegarde', () => {
  it('aller-retour sans perte', () => {
    const data = createDemoData(new Date('2026-10-18'))
    expect(parseBackup(serializeBackup(data))).toEqual(data)
  })
  it('refuse un fichier non reconnu ou un export IA', () => {
    expect(() => parseBackup('pas du json')).toThrow(ImportError)
    expect(() => parseBackup('{"foo":1}')).toThrow(ImportError)
    const ai = serializeAiExport(createDemoData())
    expect(() => parseBackup(ai)).toThrow(/pour IA/)
  })
  it('complète les champs manquants', () => {
    const d = parseBackup(JSON.stringify({ app: 'riftbound-tracker', schemaVersion: 1, matches: [{ id: 'x', games: [{}], opponent: {} }] }))
    expect(d.legends.length).toBeGreaterThan(10)
    expect(d.matches[0].games[0].reasonTagIds).toEqual([])
    expect(d.matches[0].custom).toEqual({})
  })
})

describe('fusion', () => {
  it('ajoute les nouveaux matchs et garde la version la plus récente', () => {
    const base = createDemoData(new Date('2026-10-18'))
    const incoming = structuredClone(base)
    incoming.matches[0] = { ...incoming.matches[0], comment: 'modifié', updatedAt: '2099-01-01T00:00:00Z' }
    incoming.matches.push({ ...incoming.matches[1], id: 'nouveau' })
    const current = structuredClone(base)
    current.matches[1] = { ...current.matches[1], comment: 'local', updatedAt: '2099-01-01T00:00:00Z' }
    const merged = mergeData(current, incoming)
    expect(merged.matches.length).toBe(base.matches.length + 1)
    expect(merged.matches.find((m) => m.id === base.matches[0].id)!.comment).toBe('modifié')
    expect(merged.matches.find((m) => m.id === base.matches[1].id)!.comment).toBe('local')
  })
})

describe('export IA', () => {
  it('ne contient pas les ids et résout les noms', () => {
    const data = createDemoData(new Date('2026-10-18'))
    const text = serializeAiExport(data)
    expect(text).not.toMatch(/"(lg|tt|tag|bf|deck|cf)-/)
    expect(text).not.toContain('demo-0-1')
    const parsed = JSON.parse(text)
    expect(parsed.format).toBe('riftbound-ai-export')
    expect(parsed.matches[0].myDeck.legend).toBe('Jinx')
    expect(parsed.matches[0].games[0].myBattlefield).toMatch(/Battlefield/)
    expect(parsed.summary.byOpponentLegend.length).toBeGreaterThan(3)
    expect(parsed.instructions.suggestedPrompt).toBeTruthy()
  })
  it('marche sans données', () => {
    expect(JSON.parse(serializeAiExport(createDefaultData())).summary.matchCount).toBe(0)
  })
})
