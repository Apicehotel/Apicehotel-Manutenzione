import test from 'node:test'
import assert from 'node:assert/strict'
import { MaintenanceKnowledgeEngine, MaintenanceDecisionEngine, KnowledgeTrust } from '../src/randai/maintenance/index.js'
import { MemoryEngine, MemoryStore, MemoryType, MemoryTrust } from '../src/randai/memory/index.js'
import { KnowledgeGapEngine, KnowledgeGapStore } from '../src/randai/gaps/index.js'
import { GuidedProcedureEngine, GuidanceStore, GuidanceStatus, StepResult } from '../src/randai/guidance/index.js'

function knowledgeWithHotWaterProcedure() {
  const engine = new MaintenanceKnowledgeEngine()
  engine.registerProcedure({
    id: 'gio-hot-water-wine', hotelId: 'hotelgio', title: 'Assenza acqua calda camere Wine',
    summary: 'Verifica se il problema è singola camera o intera zona e controlla il ricircolo secondo procedura.',
    symptom: 'camera senza acqua calda', area: 'Wine', keywords: ['acqua calda', 'camera', 'wine'],
    steps: [
      { id: 'scope', title: 'Verificare se il problema riguarda solo la camera', requiredRole: 'staff', next: { FOUND: 'zone', NOT_FOUND: 'room', default: 'room' } },
      { id: 'zone', title: 'Controllare il circuito di ricircolo di zona', requiredRole: 'manutentore', next: { DONE: null }, stopOn: ['CANNOT_VERIFY'] },
      { id: 'room', title: 'Controllare i punti accessibili della camera', requiredRole: 'manutentore', next: { DONE: null } },
    ],
  })
  engine.approveProcedure('gio-hot-water-wine', { hotelId: 'hotelgio', approvedBy: 'test' })
  return engine
}

test('smart maintenance ranks approved procedure above related experience and preserves provenance', async () => {
  const knowledge = knowledgeWithHotWaterProcedure()
  const memory = new MemoryEngine({ store: new MemoryStore() })
  await memory.remember({ type: MemoryType.EPISODIC, scope: 'hotel', hotelId: 'hotelgio', trust: MemoryTrust.VERIFIED, content: 'Caso precedente: acqua calda assente in Wine, problema risolto sul ricircolo', summary: 'Caso precedente Wine: ricircolo', source: { kind: 'task', id: 'old-1' }, importance: 0.8, confidence: 1 })
  const decision = new MaintenanceDecisionEngine({ knowledgeEngine: knowledge, memoryEngine: memory, gapEngine: new KnowledgeGapEngine({ store: new KnowledgeGapStore() }) })
  const result = await decision.assess({ hotelId: 'hotelgio', report: 'camera 412 senza acqua calda', area: 'Wine' })
  assert.equal(result.canStartGuidance, true)
  assert.equal(result.suggestions[0].kind, 'procedure')
  assert.equal(result.suggestions[0].trust, 'APPROVED')
  assert.equal(result.suggestions[0].provenance.id, 'gio-hot-water-wine')
})

test('unknown report creates gap and never invents a procedure', async () => {
  const gaps = new KnowledgeGapEngine({ store: new KnowledgeGapStore() })
  const decision = new MaintenanceDecisionEngine({ knowledgeEngine: new MaintenanceKnowledgeEngine(), gapEngine: gaps })
  const result = await decision.assess({ hotelId: 'hotelgio', report: 'dove si trova la valvola speciale del tetto' })
  assert.equal(result.canStartGuidance, false)
  assert.equal(result.suggestions.length, 0)
  assert.equal(result.unknowns[0].trust, 'UNKNOWN')
  assert.ok(result.gap)
})

test('guided procedure branches and persists progress across engine instances with hotel scope', async () => {
  const store = new GuidanceStore()
  const procedure = knowledgeWithHotWaterProcedure().getProcedure('gio-hot-water-wine', { hotelId: 'hotelgio' })
  const first = new GuidedProcedureEngine({ store })
  let session = await first.start({ procedure, actorRole: 'manutentore', report: 'camera 412 senza acqua calda' })
  session = await first.answer(session.id, StepResult.FOUND, { hotelId: 'hotelgio' })
  assert.equal(session.currentStepId, 'zone')
  const second = new GuidedProcedureEngine({ store })
  const resumed = await second.current(session.id, { hotelId: 'hotelgio' })
  assert.equal(resumed.step.id, 'zone')
  await assert.rejects(() => second.current(session.id, { hotelId: 'chocohotel' }), /requested scope/)
  session = await second.answer(session.id, StepResult.DONE, { hotelId: 'hotelgio' })
  assert.equal(session.status, GuidanceStatus.COMPLETED)
  assert.equal(session.history.length, 2)
})

test('authorization gate blocks staff before technician step and allows controlled resume with higher role', async () => {
  const store = new GuidanceStore()
  const procedure = knowledgeWithHotWaterProcedure().getProcedure('gio-hot-water-wine', { hotelId: 'hotelgio' })
  const engine = new GuidedProcedureEngine({ store })
  let session = await engine.start({ procedure, actorRole: 'staff' })
  session = await engine.answer(session.id, StepResult.FOUND, { hotelId: 'hotelgio' })
  assert.equal(session.status, GuidanceStatus.BLOCKED)
  assert.equal(session.currentStepId, 'zone')
  assert.match(session.blockedReason, /manutentore/)
  session = await engine.resume(session.id, { actorRole: 'manutentore', hotelId: 'hotelgio' })
  assert.equal(session.status, GuidanceStatus.ACTIVE)
  session = await engine.answer(session.id, StepResult.DONE, { hotelId: 'hotelgio' })
  assert.equal(session.status, GuidanceStatus.COMPLETED)
})

test('stop condition pauses unsafe uncertainty instead of skipping forward', async () => {
  const procedure = knowledgeWithHotWaterProcedure().getProcedure('gio-hot-water-wine', { hotelId: 'hotelgio' })
  const engine = new GuidedProcedureEngine()
  let session = await engine.start({ procedure, actorRole: 'manutentore' })
  session = await engine.answer(session.id, StepResult.FOUND, { hotelId: 'hotelgio' })
  session = await engine.answer(session.id, StepResult.CANNOT_VERIFY, { hotelId: 'hotelgio' })
  assert.equal(session.status, GuidanceStatus.BLOCKED)
  assert.match(session.blockedReason, /CANNOT_VERIFY/)
})
