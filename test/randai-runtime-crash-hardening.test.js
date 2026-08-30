import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableTaskRunner, MemoryTaskStore, RuntimeTaskStatus, RuntimeStepStatus, CheckpointKind } from '../src/randai/runtime/index.js'

function makeRunner({ execute } = {}) {
  const store = new MemoryTaskStore()
  const planner = { plan: async ({ proposedPlan }) => proposedPlan }
  const registry = { execute: execute || (async () => ({ status: 'SUCCESS', data: { ok: true } })) }
  const verifier = { verify: async ({ result }) => ({ ok: result?.status === 'SUCCESS' }) }
  return { store, runner: new DurableTaskRunner({ planner, registry, verifier, store }) }
}

const plan = { id: 'p', steps: [{ id: 'write', title: 'write', strategies: [{ toolId: 'repo.write', input: { path: 'x' } }] }] }

test('durable runner checkpoints RUNNING before executing an effect', async () => {
  const { store, runner } = makeRunner({
    execute: async (_toolId, _input, { task }) => {
      const persisted = await store.load(task.id)
      assert.equal(persisted.steps.write.status, RuntimeStepStatus.RUNNING)
      assert.equal(persisted.checkpoint.kind, CheckpointKind.STEP_STARTED)
      return { status: 'SUCCESS' }
    },
  })
  const task = await runner.create({ objective: 'write', proposedPlan: plan })
  const done = await runner.resume(task.id)
  assert.equal(done.status, RuntimeTaskStatus.SUCCEEDED)
})

test('two simultaneous resumes in one runtime execute the effect once', async () => {
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const { runner } = makeRunner({ execute: async () => { calls += 1; await gate; return { status: 'SUCCESS' } } })
  const task = await runner.create({ objective: 'write once', proposedPlan: plan })
  const a = runner.resume(task.id)
  const b = runner.resume(task.id)
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(calls, 1)
  release()
  const [first, second] = await Promise.all([a, b])
  assert.equal(first.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(second.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(calls, 1)
})

test('interrupted RUNNING step fails closed and is not re-executed automatically', async () => {
  let calls = 0
  const { store, runner } = makeRunner({ execute: async () => { calls += 1; return { status: 'SUCCESS' } } })
  const task = await runner.create({ objective: 'recover crash', proposedPlan: plan })
  const crashed = await store.load(task.id)
  crashed.status = RuntimeTaskStatus.RUNNING
  crashed.steps.write.status = RuntimeStepStatus.RUNNING
  crashed.steps.write.startedAt = new Date().toISOString()
  crashed.checkpoint = { kind: CheckpointKind.STEP_STARTED, stepId: 'write', at: new Date().toISOString() }
  await store.save(crashed)

  const blocked = await runner.resume(task.id)
  assert.equal(blocked.status, RuntimeTaskStatus.BLOCKED)
  assert.equal(blocked.steps.write.status, RuntimeStepStatus.BLOCKED)
  assert.equal(calls, 0)
  const error = blocked.errors.find((item) => item.code === 'INTERRUPTED_STEP_REQUIRES_RECONCILIATION')
  assert.equal(error.stepId, 'write')
  assert.equal(error.previousStatus, RuntimeStepStatus.RUNNING)
})

test('human reconciliation can mark interrupted effect succeeded without replay', async () => {
  let calls = 0
  const { store, runner } = makeRunner({ execute: async () => { calls += 1; return { status: 'SUCCESS' } } })
  const task = await runner.create({ objective: 'recover known success', proposedPlan: plan })
  const crashed = await store.load(task.id)
  crashed.status = RuntimeTaskStatus.RUNNING
  crashed.steps.write.status = RuntimeStepStatus.VERIFYING
  crashed.steps.write.result = { status: 'SUCCESS', data: { externalId: 'abc' } }
  await store.save(crashed)

  await runner.resume(task.id)
  const reconciled = await runner.reconcileInterrupted(task.id, 'write', { resolution: 'SUCCEEDED', verification: { ok: true, reconciledBy: 'human' } })
  assert.equal(reconciled.steps.write.status, RuntimeStepStatus.SUCCEEDED)
  const done = await runner.resume(task.id)
  assert.equal(done.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(calls, 0)
})

test('task store rejects stale concurrent saves instead of silently overwriting state', async () => {
  const { store, runner } = makeRunner()
  const task = await runner.create({ objective: 'concurrency guard', proposedPlan: plan })
  const first = await store.load(task.id)
  const stale = await store.load(task.id)
  first.metadata.writer = 'first'
  await store.save(first)
  stale.metadata.writer = 'stale'
  await assert.rejects(() => store.save(stale), (error) => error?.code === 'TASK_REVISION_CONFLICT')
  const persisted = await store.load(task.id)
  assert.equal(persisted.metadata.writer, 'first')
})
