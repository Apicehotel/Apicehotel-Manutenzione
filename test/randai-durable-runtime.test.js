import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { RandAIPlanner, RandAIVerifier, MemoryTaskStore, DurableTaskRunner, RuntimeTaskStatus } from '../src/randai/runtime/index.js'

function makeRuntime() {
  const calls = []
  const registry = new ToolRegistry()
  registry.register({ id: 'demo.ok', name: 'OK', execute: async (input) => { calls.push(['ok', input]); return { status: 'SUCCESS', data: input } } })
  registry.register({ id: 'demo.fail', name: 'FAIL', execute: async (input) => { calls.push(['fail', input]); return { status: 'FAILED', error: { code: 'TEST_FAIL' } } } })
  const planner = new RandAIPlanner()
  const verifier = new RandAIVerifier({ verifiers: {
    mustMatch: ({ result, criteria }) => ({ ok: result?.data?.value === criteria[0], reason: 'value_mismatch' }),
  } })
  const store = new MemoryTaskStore()
  return { calls, registry, planner, verifier, store, runner: new DurableTaskRunner({ planner, registry, verifier, store }) }
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
