import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableExecutor, DurableStatus, RandDurableRuntime, authorizeDurableRun, createDurableExecutorAdapter } from '../src/randai/core/durable-runtime.js'

const context = { actor: { id: 'u1' }, hotelId: 'gio', grantedScopes: ['workflow:execute'] }

test('authorization is fail closed and hotel scoped', () => {
  assert.equal(authorizeDurableRun({}).code, 'ACTOR_REQUIRED')
  assert.equal(authorizeDurableRun({ ...context, targetHotelId: 'choco' }).code, 'CROSS_HOTEL_DENIED')
  assert.equal(authorizeDurableRun(context).allowed, true)
})

test('idempotency prevents duplicate execution', async () => {
  let calls = 0
  const runtime = new RandDurableRuntime()
  const workflow = { id: 'report', execute: async () => ({ output: ++calls }) }
  const first = await runtime.start({ workflow, context, idempotencyKey: 'report:1' })
  const second = await runtime.start({ workflow, context, idempotencyKey: 'report:1' })
  assert.equal(first.id, second.id)
  assert.equal(second.output, 1)
  assert.equal(calls, 1)
})

test('resume reauthorizes and refreshes knowledge', async () => {
  let allowed = true
  let fresh = 0
  const runtime = new RandDurableRuntime({
    reauthorize: async (ctx) => allowed ? authorizeDurableRun(ctx) : { allowed: false, code: 'SCOPE_DENIED' },
    refreshKnowledge: async () => ({ version: ++fresh }),
  })
  const workflow = {
    id: 'approval', version: '1',
    execute: async ({ checkpoint, knowledge }) => checkpoint ? { output: knowledge.version } : { wait: true, checkpoint: { step: 1 } },
  }
  const waiting = await runtime.start({ workflow, context, idempotencyKey: 'approval:1' })
  assert.equal(waiting.status, DurableStatus.WAITING)
  const done = await runtime.resume({ runId: waiting.id, workflow, context })
  assert.equal(done.output, 2)
  allowed = false
  const waiting2 = await runtime.start({ workflow, context, idempotencyKey: 'approval:2' })
  assert.equal(waiting2.status, 'DENIED')
})

test('stale actor and workflow version fail closed', async () => {
  const runtime = new RandDurableRuntime()
  const v1 = { id: 'long', version: '1', execute: async () => ({ wait: true, checkpoint: { step: 1 } }) }
  const waiting = await runtime.start({ workflow: v1, context, idempotencyKey: 'long:1' })
  const actorSwap = await runtime.resume({ runId: waiting.id, workflow: v1, context: { ...context, actor: { id: 'u2' } } })
  assert.equal(actorSwap.errorCode, 'REAUTHORIZATION_FAILED')

  const runtime2 = new RandDurableRuntime()
  const waiting2 = await runtime2.start({ workflow: v1, context, idempotencyKey: 'long:2' })
  const v2 = { ...v1, version: '2' }
  const mismatch = await runtime2.resume({ runId: waiting2.id, workflow: v2, context })
  assert.equal(mismatch.errorCode, 'WORKFLOW_VERSION_MISMATCH')
})

test('retry is bounded and cancel is terminal', async () => {
  let calls = 0
  const runtime = new RandDurableRuntime()
  const workflow = { id: 'retry', execute: async () => { calls += 1; const error = new Error('temporary'); error.retryable = true; throw error } }
  let run = await runtime.start({ workflow, context, idempotencyKey: 'retry:1', maxAttempts: 2 })
  assert.equal(run.status, DurableStatus.WAITING)
  run = await runtime.resume({ runId: run.id, workflow, context })
  assert.equal(run.status, DurableStatus.FAILED)
  assert.equal(calls, 2)

  const runtime2 = new RandDurableRuntime()
  const waiter = { id: 'cancel', execute: async () => ({ wait: true }) }
  const waiting = await runtime2.start({ workflow: waiter, context, idempotencyKey: 'cancel:1' })
  const cancelled = await runtime2.cancel(waiting.id)
  assert.equal(cancelled.status, DurableStatus.CANCELLED)
  assert.equal((await runtime2.resume({ runId: waiting.id, workflow: waiter, context })).status, DurableStatus.CANCELLED)
})

test('external executor remains an explicit adapter', () => {
  assert.equal(createDurableExecutorAdapter({}).name, DurableExecutor.RAND)
  assert.throws(() => createDurableExecutorAdapter({ name: DurableExecutor.TRIGGER_DEV }), /enqueue/)
})
