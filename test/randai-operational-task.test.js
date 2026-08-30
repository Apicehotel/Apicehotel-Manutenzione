import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import {
  RandAIPlanner,
  RandAIVerifier,
  DurableTaskRunner,
  OperationalMemoryTaskStore,
  OperationalTaskCoordinator,
  classifyGioRoomSection,
  extractRoomNumber,
  summarizeOperationalTask,
} from '../src/randai/runtime/index.js'

function makeCoordinator({ supervisor = null } = {}) {
  const registry = new ToolRegistry()
  const calls = []
  registry.register({
    id: 'demo.inspect',
    name: 'Inspect',
    execute: async (input, runtime) => {
      calls.push({ input, idempotencyKey: runtime?.idempotencyKey })
      return { status: 'SUCCESS', data: input }
    },
  })
  const planner = new RandAIPlanner()
  const verifier = new RandAIVerifier()
  const store = new OperationalMemoryTaskStore()
  const runner = new DurableTaskRunner({ planner, registry, verifier, store })
  return { calls, store, runner, coordinator: new OperationalTaskCoordinator({ runner, store, supervisor }) }
}

const oneStepPlan = {
  steps: [
    { id: 'inspect', title: 'Controlla la segnalazione', strategies: [{ toolId: 'demo.inspect', input: { kind: 'issue' } }] },
  ],
}

test('Hotel Gio room numbering invariant keeps Wine and Jazz distinct', () => {
  assert.equal(extractRoomNumber('Camera · 214'), '214')
  assert.equal(classifyGioRoomSection('Camera · 214'), 'Wine')
  assert.equal(classifyGioRoomSection('201'), 'Wine')
  assert.equal(classifyGioRoomSection('Camera · 1114'), 'Jazz')
  assert.equal(classifyGioRoomSection('1101'), 'Jazz')
  assert.equal(classifyGioRoomSection('Hall'), null)
})

test('one issue reuses its active persistent RandAI task', async () => {
  const { coordinator } = makeCoordinator()
  const issue = { id: 'ISS-214', room: 'Camera · 214', title: 'Climatizzatore non raffredda', status: 'todo', urgency: 'media' }
  const first = await coordinator.createOrReuseIssueTask({ hotelId: 'gio', issue, proposedPlan: oneStepPlan })
  const second = await coordinator.createOrReuseIssueTask({ hotelId: 'gio', issue, proposedPlan: oneStepPlan })

  assert.equal(first.reused, false)
  assert.equal(second.reused, true)
  assert.equal(second.task.id, first.task.id)
  assert.equal(first.task.metadata.section, 'Wine')
  assert.equal(first.task.metadata.room, '214')
})

test('same issue id in another hotel does not cross hotel boundary', async () => {
  const { coordinator } = makeCoordinator()
  const issue = { id: '42', room: 'Camera · 214', title: 'Test' }
  const gio = await coordinator.createOrReuseIssueTask({ hotelId: 'gio', issue, proposedPlan: oneStepPlan })
  const brigantino = await coordinator.createOrReuseIssueTask({ hotelId: 'brigantino', issue, proposedPlan: oneStepPlan })
  assert.notEqual(gio.task.id, brigantino.task.id)
})

test('operational summary exposes progress, next step and checkpoint for RandApp UI', async () => {
  const { coordinator } = makeCoordinator()
  const issue = { id: 'ISS-1114', room: 'Camera · 1114', title: 'Verifica fan coil' }
  const created = await coordinator.createOrReuseIssueTask({ hotelId: 'gio', issue, proposedPlan: {
    steps: [
      { id: 'inspect', title: 'Ispeziona', strategies: [{ toolId: 'demo.inspect', input: { n: 1 } }] },
      { id: 'verify', title: 'Verifica risultato', dependsOn: ['inspect'], strategies: [{ toolId: 'demo.inspect', input: { n: 2 } }] },
    ],
  } })

  const initial = summarizeOperationalTask(created.task)
  assert.equal(initial.section, 'Jazz')
  assert.equal(initial.completedSteps, 0)
  assert.equal(initial.nextStepTitle, 'Ispeziona')

  const advanced = await coordinator.advanceIssueTask({ hotelId: 'gio', issueId: issue.id, pauseAfterSteps: 1 })
  assert.equal(advanced.summary.completedSteps, 1)
  assert.equal(advanced.summary.totalSteps, 2)
  assert.equal(advanced.summary.nextStepTitle, 'Verifica risultato')
  assert.equal(advanced.summary.status, 'PAUSED')
  assert.equal(advanced.summary.checkpoint.kind, 'PAUSED')
})

test('Supervisor advances the durable task instead of creating a parallel execution path', async () => {
  const supervisorCalls = []
  const supervisor = {
    run: async ({ taskId, executeSingle, context }) => {
      supervisorCalls.push({ taskId, context })
      const result = await executeSingle()
      return { id: 'SUP-test', status: 'SUCCEEDED', result }
    },
  }
  const { coordinator, calls } = makeCoordinator({ supervisor })
  const issue = { id: 'ISS-29', room: 'Camera · 201', title: 'Controllo operativo' }
  const created = await coordinator.createOrReuseIssueTask({ hotelId: 'gio', issue, proposedPlan: oneStepPlan })
  const advanced = await coordinator.advanceIssueTask({ hotelId: 'gio', issueId: issue.id })

  assert.equal(supervisorCalls.length, 1)
  assert.equal(supervisorCalls[0].taskId, created.task.id)
  assert.equal(supervisorCalls[0].context.sourceId, issue.id)
  assert.equal(calls.length, 1)
  assert.equal(advanced.task.status, 'SUCCEEDED')
  assert.equal(advanced.summary.completedSteps, 1)
  assert.ok(calls[0].idempotencyKey.includes(created.task.id))
})
