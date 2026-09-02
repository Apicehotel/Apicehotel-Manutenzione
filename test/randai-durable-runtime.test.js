import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { RandAIPlanner, RandAIVerifier, MemoryTaskStore, DurableTaskRunner, RuntimeTaskStatus } from '../src/randai/runtime/index.js'
import { RecoveryAction } from '../src/randai/recovery/contracts.js'

function makeRuntime(options = {}) {
  const calls = []
  const registry = new ToolRegistry()
  registry.register({ id: 'demo.ok', name: 'OK', execute: async (input) => { calls.push(['ok', input]); return { status: 'SUCCESS', data: input } } })
  registry.register({ id: 'demo.fail', name: 'FAIL', execute: async (input) => { calls.push(['fail', input]); return { status: 'FAILED', error: { code: 'TEST_FAIL' } } } })
  const planner = new RandAIPlanner()
  const verifier = new RandAIVerifier({ verifiers: {
    mustMatch: ({ result, criteria }) => ({ ok: result?.data?.value === criteria[0], reason: 'value_mismatch' }),
  } })
  const store = new MemoryTaskStore()
  return { calls, registry, planner, verifier, store, runner: new DurableTaskRunner({ planner, registry, verifier, store, ...options }) }
}

test('durable task resumes from checkpoint without rerunning completed steps', async () => {
  const { runner, calls } = makeRuntime()
  const task = await runner.create({ objective: 'two step job', proposedPlan: {
    steps: [
      { id: 'inspect', title: 'Inspect', strategies: [{ toolId: 'demo.ok', input: { step: 1 } }] },
      { id: 'build', title: 'Build', dependsOn: ['inspect'], strategies: [{ toolId: 'demo.ok', input: { step: 2 } }] },
    ],
  } })
  const paused = await runner.resume(task.id, { pauseAfterSteps: 1 })
  assert.equal(paused.status, RuntimeTaskStatus.PAUSED)
  assert.equal(calls.length, 1)
  const resumed = await runner.resume(task.id)
  assert.equal(resumed.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map((x) => x[1].step), [1, 2])
})

test('failed strategy is replaced by fallback and decision is recorded', async () => {
  const { runner, calls } = makeRuntime()
  const task = await runner.create({ objective: 'recover', proposedPlan: {
    steps: [{ id: 'write', title: 'Write', strategies: [
      { toolId: 'demo.fail', input: { route: 'A' } },
      { toolId: 'demo.ok', input: { route: 'B' } },
    ] }],
  } })
  const done = await runner.resume(task.id)
  assert.equal(done.status, RuntimeTaskStatus.SUCCEEDED)
  assert.deepEqual(calls.map((x) => x[0]), ['fail', 'ok'])
  assert.equal(done.decisions.length, 1)
  assert.equal(done.decisions[0].type, 'STRATEGY_CHANGE')
  assert.equal(done.steps.write.attempts, 2)
})

test('independent verification can reject a technically successful tool call', async () => {
  const { runner } = makeRuntime()
  const task = await runner.create({ objective: 'verify', proposedPlan: {
    steps: [{ id: 'check', title: 'Check', strategies: [{ toolId: 'demo.ok', input: { value: 1 } }], verification: { verifierId: 'mustMatch', criteria: [2] } }],
  } })
  const done = await runner.resume(task.id)
  assert.equal(done.status, RuntimeTaskStatus.FAILED)
  assert.equal(done.steps.check.status, 'FAILED')
  assert.equal(done.steps.check.verification.ok, false)
})

test('DAG step stays blocked until all declared dependencies succeed', async () => {
  const { runner, calls } = makeRuntime()
  const task = await runner.create({ objective: 'dag', proposedPlan: {
    steps: [
      { id: 'a', title: 'A', strategies: [{ toolId: 'demo.ok', input: { step: 'a' } }] },
      { id: 'b', title: 'B', strategies: [{ toolId: 'demo.ok', input: { step: 'b' } }] },
      { id: 'c', title: 'C', dependsOn: ['a', 'b'], strategies: [{ toolId: 'demo.ok', input: { step: 'c' } }] },
    ],
  } })
  const done = await runner.resume(task.id)
  assert.equal(done.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(calls.at(-1)[1].step, 'c')
  assert.equal(done.checkpoint.kind, 'COMPLETED')
})

test('planner rejects self dependencies, cycles and strategies without tools', async () => {
  const { runner } = makeRuntime()
  await assert.rejects(() => runner.create({ objective: 'self', proposedPlan: { steps: [{ id: 'a', title: 'A', dependsOn: ['a'], strategies: [{ toolId: 'demo.ok' }] }] } }), /cannot depend on itself/)
  await assert.rejects(() => runner.create({ objective: 'cycle', proposedPlan: { steps: [
    { id: 'a', title: 'A', dependsOn: ['b'], strategies: [{ toolId: 'demo.ok' }] },
    { id: 'b', title: 'B', dependsOn: ['a'], strategies: [{ toolId: 'demo.ok' }] },
  ] } }), /dependency cycle/)
  await assert.rejects(() => runner.create({ objective: 'tool', proposedPlan: { steps: [{ id: 'a', title: 'A', strategies: [{}] }] } }), /toolId/)
})

test('operational task scope is preserved in checkpoints and enforced on resume and cancel', async () => {
  const { runner } = makeRuntime()
  const task = await runner.create({
    objective: 'hotel task',
    metadata: { hotelId: 'hotelgio', sourceType: 'issue', sourceId: '42' },
    proposedPlan: { steps: [{ id: 'a', title: 'A', strategies: [{ toolId: 'demo.ok' }] }] },
  })
  assert.equal(task.checkpoint.hotelId, 'hotelgio')
  await assert.rejects(() => runner.resume(task.id), /hotelId is required/)
  await assert.rejects(() => runner.resume(task.id, { hotelId: 'chocohotel' }), /outside the requested hotel scope/)
  const paused = await runner.resume(task.id, { hotelId: 'hotelgio', pauseAfterSteps: 1 })
  assert.equal(paused.checkpoint.hotelId, 'hotelgio')
  const cancelled = await runner.cancel(task.id, { hotelId: 'hotelgio', reason: 'test' })
  assert.equal(cancelled.status, RuntimeTaskStatus.CANCELLED)
  assert.equal(cancelled.checkpoint.kind, 'CANCELLED')
  assert.equal(cancelled.checkpoint.hotelId, 'hotelgio')
})

test('recovery retry is bounded per strategy', async () => {
  const recoveryEngine = {
    decide: () => ({ action: RecoveryAction.RETRY_SAME, reason: 'transient' }),
    record: () => {},
  }
  const { runner, calls } = makeRuntime({ recoveryEngine, maxAttemptsPerStrategy: 2 })
  const task = await runner.create({ objective: 'bounded retry', proposedPlan: {
    steps: [{ id: 'a', title: 'A', strategies: [{ toolId: 'demo.fail' }] }],
  } })
  const done = await runner.resume(task.id)
  assert.equal(done.status, RuntimeTaskStatus.FAILED)
  assert.equal(calls.length, 2)
  assert.equal(done.steps.a.attempts, 2)
  assert.ok(done.decisions.some((decision) => decision.type === 'RETRY_BUDGET_EXHAUSTED'))
})
