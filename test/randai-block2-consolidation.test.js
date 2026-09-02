import test from 'node:test'
import assert from 'node:assert/strict'

import { MaintenanceKnowledgeEngine } from '../src/randai/maintenance/engine.js'
import { ProcedureAssistant } from '../src/randai/maintenance/procedure-assistant.js'
import { KnowledgeTrust } from '../src/randai/maintenance/contracts.js'
import { validatePlan, RuntimeTaskStatus, RuntimeStepStatus } from '../src/randai/runtime/contracts.js'
import { RandAIPlanner } from '../src/randai/runtime/planner.js'
import { DurableTaskRunner } from '../src/randai/runtime/durable-runner.js'
import { cancelDurableTask } from '../src/randai/runtime/task-control.js'
import { MemoryTaskStore } from '../src/randai/runtime/store.js'

test('block 2 / point 5: knowledge ids are isolated by hotel and reads fail closed without scope', () => {
  const engine = new MaintenanceKnowledgeEngine()
  const procedure = (hotelId, summary) => ({ id: 'RESET-1', hotelId, title: 'Reset impianto', summary })
  engine.registerProcedure(procedure('hotelgio', 'Procedura Giò'))
  engine.registerProcedure(procedure('chocohotel', 'Procedura Choco'))

  assert.equal(engine.getProcedure('RESET-1', { hotelId: 'hotelgio' }).summary, 'Procedura Giò')
  assert.equal(engine.getProcedure('RESET-1', { hotelId: 'chocohotel' }).summary, 'Procedura Choco')
  assert.throws(() => engine.getProcedure('RESET-1'), /hotelId is required/)
  assert.throws(() => engine.listProcedures(), /hotelId is required/)
  assert.throws(() => engine.approveProcedure('RESET-1', { approvedBy: 'tester' }), /hotelId is required/)
})

test('block 2 / point 5: evidence cannot cross hotel boundaries', () => {
  const engine = new MaintenanceKnowledgeEngine()
  engine.registerProcedure({ id: 'PROC-1', hotelId: 'hotelgio', title: 'Proc', summary: 'Test' })
  engine.registerEquipment({ id: 'EQ-1', hotelId: 'chocohotel', name: 'Pompa' })

  assert.throws(() => engine.addEvidence({
    id: 'E-1', hotelId: 'hotelgio', type: 'photo', label: 'Foto', procedureId: 'PROC-1', equipmentId: 'EQ-1',
  }), /Unknown equipment in evidence scope/)
})

test('block 2 / point 6: procedure approval preserves hotel scope end to end', () => {
  const assistant = new ProcedureAssistant()
  const engine = new MaintenanceKnowledgeEngine()
  const draft = assistant.compose({
    hotelId: 'hotelgio',
    text: '1. Spegnere il quadro\n2. Verificare il contatto',
    hints: { title: 'Controllo quadro', area: 'Sala A' },
  })

  const approved = assistant.approve(draft, engine, { approvedBy: 'direzione' })
  assert.equal(approved.hotelId, 'hotelgio')
  assert.equal(approved.trust, KnowledgeTrust.APPROVED)
  assert.equal(engine.getProcedure(approved.id, { hotelId: 'hotelgio' }).approvedBy, 'direzione')
  assert.equal(engine.getProcedure(approved.id, { hotelId: 'chocohotel' }), null)

  const tampered = structuredClone(draft)
  tampered.proposal.hotelId = 'chocohotel'
  assert.throws(() => assistant.approve(tampered, new MaintenanceKnowledgeEngine()), /scope mismatch/)
})

test('block 2 / point 7: execution plans reject malformed dependency graphs', () => {
  const strategy = { toolId: 'maintenance.check', input: {} }
  assert.throws(() => validatePlan({ steps: [{ id: 'a', title: 'A', strategies: [strategy], dependsOn: ['a'] }] }), /cannot depend on itself/)
  assert.throws(() => validatePlan({ steps: [
    { id: 'a', title: 'A', strategies: [strategy], dependsOn: ['b'] },
    { id: 'b', title: 'B', strategies: [strategy], dependsOn: ['a'] },
  ] }), /dependency cycle/)
  assert.throws(() => validatePlan({ steps: [{ id: 'a', title: 'A', strategies: [{}] }] }), /strategy requires toolId/)
})

test('block 2 / point 7: failed verification can never become task success', async () => {
  const planner = new RandAIPlanner()
  const store = new MemoryTaskStore()
  const registry = { execute: async () => ({ status: 'SUCCESS', data: { ok: true } }) }
  const verifier = { verify: async () => ({ ok: false, reason: 'evidence_missing' }) }
  const runner = new DurableTaskRunner({ planner, registry, verifier, store })
  const task = await runner.create({
    objective: 'Verifica impianto',
    metadata: { hotelId: 'hotelgio' },
    proposedPlan: { steps: [{ id: 'check', title: 'Controlla', strategies: [{ toolId: 'maintenance.check', input: {} }] }] },
  })

  const result = await runner.resume(task.id)
  assert.equal(result.status, RuntimeTaskStatus.FAILED)
  assert.equal(result.steps.check.status, RuntimeStepStatus.FAILED)
  assert.equal(result.steps.check.verification.ok, false)
})

test('block 2 / point 8: pause and resume persist checkpoints without replaying completed effects', async () => {
  const planner = new RandAIPlanner()
  const store = new MemoryTaskStore()
  const calls = []
  const registry = { execute: async (toolId, input, context) => {
    calls.push({ toolId, key: context.idempotencyKey })
    return { status: 'SUCCESS', data: { ok: true } }
  } }
  const verifier = { verify: async () => ({ ok: true }) }
  const runner = new DurableTaskRunner({ planner, registry, verifier, store })
  const task = await runner.create({
    objective: 'Due passi',
    metadata: { hotelId: 'hotelgio' },
    proposedPlan: { steps: [
      { id: 'one', title: 'Uno', strategies: [{ toolId: 'maintenance.one', input: {} }] },
      { id: 'two', title: 'Due', dependsOn: ['one'], strategies: [{ toolId: 'maintenance.two', input: {} }] },
    ] },
  })

  const paused = await runner.resume(task.id, { pauseAfterSteps: 1 })
  assert.equal(paused.status, RuntimeTaskStatus.PAUSED)
  assert.deepEqual(calls.map((item) => item.toolId), ['maintenance.one'])

  const completed = await runner.resume(task.id)
  assert.equal(completed.status, RuntimeTaskStatus.SUCCEEDED)
  assert.deepEqual(calls.map((item) => item.toolId), ['maintenance.one', 'maintenance.two'])
  assert.equal(new Set(calls.map((item) => item.key)).size, 2)
})

test('block 2 / point 8: cancellation is leased, persisted and terminal', async () => {
  const planner = new RandAIPlanner()
  const store = new MemoryTaskStore()
  const runner = new DurableTaskRunner({
    planner,
    store,
    registry: { execute: async () => ({ status: 'SUCCESS' }) },
    verifier: { verify: async () => ({ ok: true }) },
  })
  const task = await runner.create({
    objective: 'Task annullabile',
    metadata: { hotelId: 'hotelgio' },
    proposedPlan: { steps: [{ id: 'one', title: 'Uno', strategies: [{ toolId: 'maintenance.one', input: {} }] }] },
  })

  const cancelled = await cancelDurableTask({ store, taskId: task.id, reason: 'operatore', cancelledBy: 'user-1' })
  assert.equal(cancelled.status, RuntimeTaskStatus.CANCELLED)
  assert.equal(cancelled.checkpoint.kind, 'CANCELLED')
  assert.equal((await store.load(task.id)).status, RuntimeTaskStatus.CANCELLED)
  assert.equal((await runner.resume(task.id)).status, RuntimeTaskStatus.CANCELLED)
})
