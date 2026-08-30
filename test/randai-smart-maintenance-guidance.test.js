import test from 'node:test'
import assert from 'node:assert/strict'
import { MaintenanceKnowledgeEngine } from '../src/randai/maintenance/engine.js'
import { KnowledgeTrust, RelationType } from '../src/randai/maintenance/contracts.js'
import { KnowledgeGapEngine } from '../src/randai/gaps/engine.js'
import { KnowledgeGapStore } from '../src/randai/gaps/store.js'
import { MaintenanceDecisionEngine } from '../src/randai/guidance/decision-engine.js'
import { GuidedProcedureRunner } from '../src/randai/guidance/session.js'
import { GuidanceSessionStatus, StepAction, SuggestionKind } from '../src/randai/guidance/contracts.js'

const approvedProcedure = {
  id: 'hot-water-wine', hotelId: 'gio', title: 'Controllo acqua calda Wine', summary: 'Diagnosi assenza acqua calda camere Wine',
  area: 'Wine piano 4', symptom: 'acqua calda', keywords: ['acqua', 'calda', 'wine'], trust: KnowledgeTrust.APPROVED,
  steps: [{ id: 'scope', instruction: 'Verificare se il problema riguarda altre camere', requiredRole: 'staff', transitions: { DONE: 'valve', FOUND: 'valve', NOT_FOUND: 'COMPLETE', CANNOT_VERIFY: 'ESCALATE' } }, { id: 'valve', instruction: 'Controllare la valvola di ricircolo secondo procedura', requiredRole: 'manutentore', transitions: { DONE: 'COMPLETE', FOUND: 'COMPLETE', NOT_FOUND: 'ESCALATE', CANNOT_VERIFY: 'ESCALATE' } }],
}

function knowledge() {
  const engine = new MaintenanceKnowledgeEngine({ procedures: [approvedProcedure] })
  engine.registerEquipment({ id: 'valve-4', hotelId: 'gio', name: 'Valvola ricircolo piano 4', trust: KnowledgeTrust.VERIFIED, location: 'Locale tecnico piano 4' })
  engine.addRelation({ hotelId: 'gio', from: 'valve-4', to: 'Wine piano 4', type: RelationType.SERVES })
  return engine
}

test('smart suggestions rank approved procedure and verified equipment with provenance', async () => {
  const decision = new MaintenanceDecisionEngine({ knowledge: knowledge(), gaps: new KnowledgeGapEngine({ store: new KnowledgeGapStore() }) })
  const result = await decision.suggest({ hotelId: 'gio', report: 'camera senza acqua calda', area: 'Wine piano 4' })
  assert.equal(result.knowledgeFound, true)
  assert.equal(result.suggestions[0].kind, SuggestionKind.PROCEDURE)
  assert.equal(result.suggestions[0].trust, KnowledgeTrust.APPROVED)
  assert.ok(result.suggestions.some((x) => x.id === 'equipment:valve-4' && x.source.id === 'valve-4'))
})

test('unknown maintenance report opens a knowledge gap instead of inventing a procedure', async () => {
  const gaps = new KnowledgeGapEngine({ store: new KnowledgeGapStore() })
  const decision = new MaintenanceDecisionEngine({ knowledge: knowledge(), gaps })
  const result = await decision.suggest({ hotelId: 'gio', report: 'dove si resetta il compressore piscina', area: 'Piscina' })
  assert.equal(result.knowledgeFound, false)
  assert.equal(result.suggestions[0].kind, SuggestionKind.UNKNOWN)
  assert.equal(result.suggestions[0].trust, 'UNKNOWN')
  assert.equal((await gaps.list({ hotelId: 'gio' })).length, 1)
})

test('guided procedure follows explicit branches and completes', async () => {
  const runner = new GuidedProcedureRunner()
  let session = await runner.start({ procedure: approvedProcedure, actorRole: 'manutentore' })
  assert.equal(session.currentStepId, 'scope')
  session = await runner.respond(session, { action: StepAction.DONE })
  assert.equal(session.currentStepId, 'valve')
  session = await runner.respond(session, { action: StepAction.DONE, evidence: { note: 'valvola controllata' } })
  assert.equal(session.status, GuidanceSessionStatus.COMPLETED)
  assert.equal(session.completedAt !== null, true)
})

test('guided procedure blocks a role before an unauthorized technical step', async () => {
  const runner = new GuidedProcedureRunner()
  let session = await runner.start({ procedure: approvedProcedure, actorRole: 'staff' })
  session = await runner.respond(session, { action: StepAction.DONE })
  assert.equal(session.currentStepId, 'valve')
  assert.equal(session.status, GuidanceSessionStatus.BLOCKED)
  assert.equal(session.steps.find((x) => x.id === 'valve').status, 'BLOCKED')
  assert.ok(session.events.some((x) => x.type === 'PERMISSION_BLOCKED' && x.requiredRole === 'manutentore'))
})

test('guided procedure escalates when user cannot verify a diagnostic checkpoint', async () => {
  const runner = new GuidedProcedureRunner()
  let session = await runner.start({ procedure: approvedProcedure, actorRole: 'manutentore' })
  session = await runner.respond(session, { action: StepAction.CANNOT_VERIFY })
  assert.equal(session.status, GuidanceSessionStatus.ESCALATED)
})

test('procedure contract rejects dangling branch targets', async () => {
  const runner = new GuidedProcedureRunner()
  await assert.rejects(() => runner.start({ procedure: { ...approvedProcedure, steps: [{ id: 'a', instruction: 'A', transitions: { DONE: 'missing' } }] }, actorRole: 'staff' }), /Unknown guidance transition target/)
})
