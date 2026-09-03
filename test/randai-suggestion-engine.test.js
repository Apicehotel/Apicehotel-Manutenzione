import test from 'node:test'
import assert from 'node:assert/strict'
import { KnowledgeTrust } from '../src/randai/maintenance/contracts.js'
import { rankMaintenanceSuggestions, selectPrimaryMaintenanceSuggestion } from '../src/randai/maintenance/suggestion-engine.js'

test('ranks approved procedures above verified experiences and exposes safe next action', () => {
  const suggestions = rankMaintenanceSuggestions({
    query: 'camera 412 senza acqua calda Wine',
    procedures: [
      { id: 'p2', hotelId: 'hotelgio', title: 'Procedura generica', summary: 'Controllo acqua', trust: KnowledgeTrust.VERIFIED, keywords: ['acqua'] },
      { id: 'p1', hotelId: 'hotelgio', title: 'Acqua calda Wine', summary: 'Controllo ricircolo', symptom: 'acqua calda', area: 'Wine', keywords: ['acqua calda'], trust: KnowledgeTrust.APPROVED, version: 2, steps: [{ id: 'scope', title: 'Verifica l’estensione del problema' }], caution: 'Non intervenire su parti in pressione.' },
    ],
    memories: [{ id: 'm1', summary: 'Caso precedente Wine', content: 'Ricircolo risolto', trust: KnowledgeTrust.VERIFIED }],
  })
  assert.equal(suggestions[0].procedureId, 'p1')
  assert.equal(suggestions[0].actionable, true)
  assert.equal(suggestions[0].risk, 'medium')
  assert.match(suggestions[0].nextAction, /estensione/)
  assert.equal(selectPrimaryMaintenanceSuggestion(suggestions).id, 'procedure:p1')
})

test('deduplicates candidates and never makes memory actionable', () => {
  const suggestions = rankMaintenanceSuggestions({
    query: 'clima Jazz',
    procedures: [{ id: 'p1', title: 'Clima Jazz', summary: 'Controlla motore', trust: KnowledgeTrust.APPROVED, keywords: ['clima', 'Jazz'] }, { id: 'p1', title: 'Duplicato', summary: 'Duplicato', trust: KnowledgeTrust.APPROVED }],
    memories: [{ id: 'm1', summary: 'Clima Jazz', content: 'Controlla il motore', trust: KnowledgeTrust.VERIFIED }],
  })
  assert.equal(suggestions.filter((item) => item.id === 'procedure:p1').length, 1)
  assert.equal(suggestions.find((item) => item.id === 'memory:m1').actionable, false)
  assert.equal(suggestions.find((item) => item.id === 'memory:m1').nextAction.includes('non applicare'), true)
})

test('returns no hallucinated suggestion for empty query or unrelated memory', () => {
  assert.deepEqual(rankMaintenanceSuggestions({ query: '' }), [])
  assert.deepEqual(rankMaintenanceSuggestions({ query: 'ascensore', memories: [{ id: 'm1', summary: 'clima', content: 'condizionatore', trust: KnowledgeTrust.VERIFIED }] }), [])
})
