import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableStatus, InMemoryDurableStore, RandDurableRuntime, authorizeDurableRun } from '../src/randai/core/durable-runtime.js'

const context = { actor: { id: 'u1' }, hotelId: 'gio', grantedScopes: ['workflow:execute'] }

test('durable authorization is fail closed and hotel scoped', () => {
  assert.equal(authorizeDurableRun({}).code, 'ACTOR_REQUIRED')
  assert.equal(authorizeDurableRun({ actor: { id: 'u1' }, hotelId: 'gio', targetHotelId: 'choco', grantedScopes: ['workflow:execute'] }).code, 'CROSS_HOTEL_DENIED')
  assert.equal(authorizeDurableRun(context).allowed, true)
})

test('idempotency key prevents duplicate workflow execution', async () => {
  let calls = 0
  const runtime = new RandDurableRuntime()
  const workflow = { id: 'report', version: '1', execute: async () => { calls += 1; return { output: 'ok' } } }
  const first = await runtime.start({ workflow, context, idempotencyKey: 'same' })
  const second = await runtime.start({ workflow, context, idempotencyKey: 'same' })
  assert.equal(first.status, DurableStatus.SUCCEEDED)
  assert.equal(second.id, first.id)
  assert.equal(calls, 1)
})

test('resume reauthorizes and refreshes knowledge before execution', async () => {
  const store = new InMemoryDurableStore()
  let authCalls = 0; let knowledgeCalls = 0; let executeCalls = 0
  const runtime = new RandDurableRuntime({
    store,
    reauthorize: async (ctx) => { authCalls += 1; return authorizeDurableRun(ctx) },
    refreshKnowledge: async () => { knowledgeCalls += 1; return ['fresh'] },
  })
  const workflow = { id: 'long', version: '1', execute: async ({ checkpoint }) => {
    executeCalls += 1
    if (!checkpoint) return { wait: true, checkpoint: { step: 1 } }
    return { output: 'done' }
  } }
  const waiting = await runtime.start({ workflow, context, idempotencyKey: 'long-1' })
  assert.equal(waiting.status, DurableStatus.WAITING)
  const done = await runtime.resume({ runId: waiting.id, workflow, context })
  assert.equal(done.status, DurableStatus.SUCCEEDED)
  assert.equal(authCalls, 3)
  assert.equal(knowledgeCalls, 2)
  assert.equal(executeCalls, 2)
})

test('resume fails closed if authorization changed', async () => {
  let allowed = true
  const runtime = new RandDurableRuntime({ reauthorize: async (ctx) => allowed ? authorizeDurableRun(ctx) : { allowed: false, code: 'SCOPE_DENIED' } })
  const workflow = { id: 'approval', version: '1', execute: async () => ({ wait: true, checkpoint: { pending: true } }) }
  const waiting = await runtime.start({ workflow, context, idempotencyKey: 'approval-1' })
  allowed = false
  const stopped = await runtime.resume({ runId: waiting.id, workflow, context })
  assert.equal(stopped.status, DurableStatus.FAILED)
  assert.equal(stopped.errorCode, 'REAUTHORIZATION_FAILED')
})

test('retryable failures are bounded and non retryable failures stop', async () => {
  let calls = 0
  const runtime = new RandDurableRuntime()
  const workflow = { id: 'retry', version: '1', execute: async () => { calls += 1; const error = new Error('temporary'); error.retryable = true; throw error } }
  let run = await runtime.start({ workflow, context, idempotencyKey: 'retry-1', maxAttempts: 2 })
  assert.equal(run.status, DurableStatus.WAITING)
  run = await runtime.resume({ runId: run.id, workflow, context })
  assert.equal(run.status, DurableStatus.FAILED)
  assert.equal(calls, 2)
})
