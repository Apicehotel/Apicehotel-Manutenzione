import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { RandAIPlanner, RandAIVerifier, MemoryTaskStore, DurableTaskRunner } from '../src/randai/runtime/index.js'

function runtime(store, calls, waitMs = 0) {
  const registry = new ToolRegistry()
  registry.register({ id: 'lease.work', name: 'Lease work', execute: async (_input, context) => {
    calls.push(context.idempotencyKey)
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs))
    return { status: 'SUCCESS', data: { ok: true } }
  } })
  const planner = new RandAIPlanner()
  const verifier = new RandAIVerifier()
  return new DurableTaskRunner({ planner, registry, verifier, store, leaseSeconds: 30 })
}

test('only one runner can own a task lease at a time', async () => {
  const store = new MemoryTaskStore()
  const calls = []
  const first = runtime(store, calls, 40)
  const second = runtime(store, calls)
  const task = await first.create({ objective: 'lease', proposedPlan: { steps: [{ id: 'one', title: 'One', strategies: [{ toolId: 'lease.work' }] }] } })

  const active = first.resume(task.id)
  await new Promise((resolve) => setTimeout(resolve, 5))
  await assert.rejects(second.resume(task.id), (error) => error?.code === 'TASK_LEASE_CONFLICT')
  const done = await active

  assert.equal(done.status, 'SUCCEEDED')
  assert.equal(calls.length, 1)
})

test('tool calls receive deterministic idempotency keys', async () => {
  const store = new MemoryTaskStore()
  const calls = []
  const runner = runtime(store, calls)
  const task = await runner.create({ objective: 'effect key', proposedPlan: { steps: [{ id: 'write', title: 'Write', strategies: [{ toolId: 'lease.work' }] }] } })
  await runner.resume(task.id)
  assert.deepEqual(calls, [`${task.id}:write:0`])
})

test('released lease allows another runner to resume later', async () => {
  const store = new MemoryTaskStore()
  const calls = []
  const first = runtime(store, calls)
  const second = runtime(store, calls)
  const task = await first.create({ objective: 'pause', proposedPlan: { steps: [
    { id: 'one', title: 'One', strategies: [{ toolId: 'lease.work' }] },
    { id: 'two', title: 'Two', dependsOn: ['one'], strategies: [{ toolId: 'lease.work' }] },
  ] } })
  const paused = await first.resume(task.id, { pauseAfterSteps: 1 })
  assert.equal(paused.status, 'PAUSED')
  const done = await second.resume(task.id)
  assert.equal(done.status, 'SUCCEEDED')
  assert.equal(calls.length, 2)
})
