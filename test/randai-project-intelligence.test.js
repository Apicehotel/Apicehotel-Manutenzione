import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectIntelligence } from '../src/randai/project-intelligence.js'

test('correlates issue with equipment and exposes verified next actions', () => {
  const result = buildProjectIntelligence({
    hotelId: 'hotelgio',
    issue: { location: 'Wine piano 4', category: 'climatizzazione', summary: 'camera senza aria fredda' },
    equipment: [{ id: 'hvac-1', name: 'Motore climatizzazione Wine', category: 'climatizzazione', location: 'Wine piano 4' }],
    suggestions: [{ kind: 'procedure', actionable: true, nextAction: 'Controlla il circuito di zona' }],
  })
  assert.equal(result.assessment, 'CONNECTED')
  assert.equal(result.relatedEquipment[0].id, 'hvac-1')
  assert.equal(result.nextActions[0].trust, 'APPROVED')
  assert.equal(result.signals[0].label, 'Impianti collegati')
})

test('detects a pattern without promoting it to diagnosis', () => {
  const result = buildProjectIntelligence({
    hotelId: 'hotelgio',
    issue: { location: 'Wine', category: 'acqua calda', summary: 'camera senza acqua calda' },
    history: [
      { id: 'i1', location: 'Wine 401', category: 'acqua calda', description: 'assenza acqua calda' },
      { id: 'i2', location: 'Wine 402', category: 'acqua calda', description: 'assenza acqua calda' },
    ],
  })
  assert.equal(result.assessment, 'RECURRING_PATTERN')
  assert.equal(result.recurrence.recurring, true)
  assert.equal(result.hypotheses[0].status, 'HYPOTHESIS')
  assert.match(result.hypotheses[0].caution, /non è una diagnosi/)
})

test('keeps hotel scope and refuses an empty project context', () => {
  assert.throws(() => buildProjectIntelligence({ issue: { summary: 'problema' } }), /hotelId/)
  const result = buildProjectIntelligence({ hotelId: 'hotelgio', issue: {} })
  assert.equal(result.assessment, 'INSUFFICIENT_DATA')
  assert.equal(result.nextActions[0].trust, 'MISSING_DATA')
})
