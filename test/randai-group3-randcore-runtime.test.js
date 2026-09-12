import test from 'node:test'
import assert from 'node:assert/strict'

import {
  InMemoryRandCoreStore,
  RandCoreRuntime,
  RandJobStatus,
  RandWorkerStatus,
  createRandEvent
} from '../src/randai/core/randcore-runtime.js'

function harness({ now = 1_000, staleAfter = 100, durableRuntime } = {}) {
  let clockValue = now
  let id = 0
  const runtime = new RandCoreRuntime({
    store: new InMemoryRandCoreStore(),
    ...(durableRuntime ? { durableRuntime } : {}),
    clock: () => clockValue,
    idFactory: (prefix) => `${prefix}_${++id}`,
    workerStaleAfterMs: staleAfter
  })
  return { runtime, tick: (ms) => { clockValue += ms } }
}

test('event envelope is deeply immutable, correlated and hotel-scoped by default', () => {
  const event = createRandEvent({ eventId: 'evt_1', type: 'maintenance.created', source: 'randapp', hotelId: 'gio', occurredAt: 123, payload: { urgent: true, nested: { room: 214 } } })
  assert.equal(event.scope, 'HOTEL')
  assert.equal(event.hotelId, 'gio')
  assert.equal(event.correlationId, 'evt_1')
  assert.equal(event.causationId, null)
  assert.throws(() => { event.type = 'tampered' }, TypeError)
  assert.throws(() => { event.payload.urgent = false }, TypeError)
  assert.throws(() => { event.payload.nested.room = 999 }, TypeError)
})

test('event envelope fails closed on invalid hotel/system scope', () => {
  assert.throws(() => createRandEvent({ type: 'x', source: 'test', scope: 'HOTEL' }), /hotelId/)
  assert.throws(() => createRandEvent({ type: 'x', source: 'test', scope: 'SYSTEM', hotelId: 'gio' }), /SYSTEM/)
  assert.throws(() => createRandEvent({ source: 'test' }), /type/)
})

test('publish fans one event out to independent correlated jobs', async () => {
  const { runtime } = harness()
  const event = createRandEvent({ eventId: 'evt_fanout', type: 'maintenance.created', source: 'randapp', hotelId: 'gio', occurredAt: 1 })
  const published = await runtime.publish({ event, routes: [{ handlerId: 'notify-reception' }, { handlerId: 'notify-maintenance', maxAttempts: 5 }] })
  assert.equal(published.jobs.length, 2)
  assert.notEqual(published.jobs[0].id, published.jobs[1].id)
  assert.equal(published.jobs[0].eventId, 'evt_fanout')
  assert.equal(published.jobs[1].event.correlationId, 'evt_fanout')
  assert.equal(published.jobs[1].maxAttempts, 5)
})

test('job lifecycle is explicit and invalid transitions fail closed', async () => {
  const { runtime } = harness()
  const event = createRandEvent({ eventId: 'evt_1', type: 'maintenance.created', source: 'randapp', hotelId: 'gio', occurredAt: 1 })
  await runtime.registerWorker({ workerId: 'worker-a', capabilities: ['notify'] })
  const queued = await runtime.enqueue({ event, handlerId: 'notify', maxAttempts: 2 })
  assert.equal(queued.status, RandJobStatus.QUEUED)
  const running = await runtime.claim({ jobId: queued.id, workerId: 'worker-a' })
  assert.equal(running.status, RandJobStatus.RUNNING)
  assert.equal(running.attempt, 1)
  const done = await runtime.succeed(running.id, { delivered: true })
  assert.equal(done.status, RandJobStatus.SUCCEEDED)
  await assert.rejects(() => runtime.succeed(done.id), /Invalid job transition/)
})

test('retry exhaustion enters dead-letter exactly once', async () => {
  const { runtime } = harness()
  const event = createRandEvent({ eventId: 'evt_retry', type: 'notification.send', source: 'randcore', hotelId: 'gio', occurredAt: 1 })
  await runtime.registerWorker({ workerId: 'worker-a' })
  const queued = await runtime.enqueue({ event, handlerId: 'notify', maxAttempts: 2 })
  await runtime.claim({ jobId: queued.id, workerId: 'worker-a' })
  const retrying = await runtime.fail(queued.id, { retryable: true, errorCode: 'PROVIDER_DOWN' })
  assert.equal(retrying.status, RandJobStatus.RETRYING)
  await runtime.requeue(queued.id)
  await runtime.claim({ jobId: queued.id, workerId: 'worker-a' })
  const dead = await runtime.fail(queued.id, { retryable: true, errorCode: 'PROVIDER_DOWN' })
  assert.equal(dead.status, RandJobStatus.DEAD_LETTER)
  const snapshot = await runtime.snapshot()
  assert.equal(snapshot.deadLetters.total, 1)
  assert.equal(snapshot.deadLetters.items[0].reason, 'RETRY_EXHAUSTED')
  assert.equal(snapshot.jobs.counts.DEAD_LETTER, 1)
})

test('worker heartbeat detects stale workers and blocks claim', async () => {
  const { runtime, tick } = harness({ staleAfter: 100 })
  await runtime.registerWorker({ workerId: 'worker-a' })
  assert.equal((await runtime.workerHealth('worker-a')).status, RandWorkerStatus.HEALTHY)
  tick(101)
  assert.equal((await runtime.workerHealth('worker-a')).status, RandWorkerStatus.STALE)
  const event = createRandEvent({ eventId: 'evt_2', type: 'repo.scan', source: 'randradar', scope: 'SYSTEM', occurredAt: 2 })
  const queued = await runtime.enqueue({ event, handlerId: 'radar' })
  await assert.rejects(() => runtime.claim({ jobId: queued.id, workerId: 'worker-a' }), /stale/)
  await runtime.heartbeat('worker-a')
  const running = await runtime.claim({ jobId: queued.id, workerId: 'worker-a' })
  assert.equal(running.status, RandJobStatus.RUNNING)
})

test('snapshot exposes observable queue and worker health without treating stale as healthy', async () => {
  const { runtime, tick } = harness({ staleAfter: 100 })
  await runtime.registerWorker({ workerId: 'healthy' })
  tick(80)
  await runtime.registerWorker({ workerId: 'fresh' })
  tick(30)
  const event = createRandEvent({ eventId: 'evt_3', type: 'core.health', source: 'randcore', scope: 'SYSTEM', occurredAt: 3 })
  await runtime.enqueue({ event, handlerId: 'health' })
  const snapshot = await runtime.snapshot()
  assert.equal(snapshot.jobs.total, 1)
  assert.equal(snapshot.jobs.counts.QUEUED, 1)
  assert.equal(snapshot.workers.total, 2)
  assert.equal(snapshot.workers.stale, 1)
  assert.equal(snapshot.workers.healthy, 1)
  assert.throws(() => { snapshot.jobs.counts.QUEUED = 99 }, TypeError)
})

test('non-retryable failure is terminal FAILED and does not silently requeue', async () => {
  const { runtime } = harness()
  await runtime.registerWorker({ workerId: 'worker-a' })
  const event = createRandEvent({ eventId: 'evt_4', type: 'procedure.publish', source: 'procedures', hotelId: 'gio', occurredAt: 4 })
  const job = await runtime.enqueue({ event, handlerId: 'publish' })
  await runtime.claim({ jobId: job.id, workerId: 'worker-a' })
  const failed = await runtime.fail(job.id, { retryable: false, errorCode: 'POLICY_DENIED' })
  assert.equal(failed.status, RandJobStatus.FAILED)
  await assert.rejects(() => runtime.requeue(job.id), /Invalid job transition/)
})

test('durable start and resume stay synchronized with one RandCore job', async () => {
  const { runtime } = harness({ staleAfter: 10_000 })
  await runtime.registerWorker({ workerId: 'durable-worker' })
  const event = createRandEvent({ eventId: 'evt_durable', type: 'research.run', source: 'randai', hotelId: 'gio', occurredAt: 5 })
  const job = await runtime.enqueue({ event, handlerId: 'durable' })
  let calls = 0
  const workflow = {
    id: 'research',
    version: '1',
    async execute() {
      calls += 1
      if (calls === 1) return { wait: true, checkpoint: { step: 1 } }
      return { output: { complete: true } }
    }
  }
  const context = { actor: { id: 'u1' }, hotelId: 'gio', targetHotelId: 'gio', grantedScopes: ['workflow:execute'] }
  const started = await runtime.startDurable({ jobId: job.id, workerId: 'durable-worker', workflow, context, idempotencyKey: 'research-1' })
  assert.equal(started.job.status, RandJobStatus.RUNNING)
  assert.ok(started.job.durableRunId)
  const resumed = await runtime.resumeDurable({ jobId: job.id, workflow, context })
  assert.equal(resumed.job.status, RandJobStatus.SUCCEEDED)
  assert.deepEqual(resumed.job.output, { complete: true })
  assert.equal(calls, 2)
})

test('durable start exception cannot strand a job in RUNNING', async () => {
  const durableRuntime = {
    async start() {
      const error = new Error('executor unavailable')
      error.code = 'EXECUTOR_DOWN'
      throw error
    }
  }
  const { runtime } = harness({ staleAfter: 10_000, durableRuntime })
  await runtime.registerWorker({ workerId: 'durable-worker' })
  const event = createRandEvent({ eventId: 'evt_throw', type: 'research.run', source: 'randai', hotelId: 'gio', occurredAt: 6 })
  const job = await runtime.enqueue({ event, handlerId: 'durable' })
  await assert.rejects(() => runtime.startDurable({ jobId: job.id, workerId: 'durable-worker', workflow: {}, idempotencyKey: 'x' }), /executor unavailable/)
  const snapshot = await runtime.snapshot()
  assert.equal(snapshot.jobs.counts.RUNNING, 0)
  assert.equal(snapshot.jobs.counts.FAILED, 1)
})

test('retryable durable exception moves job to RETRYING instead of stranding it', async () => {
  const durableRuntime = {
    async start() {
      const error = new Error('temporary executor failure')
      error.code = 'EXECUTOR_TEMPORARY'
      error.retryable = true
      throw error
    }
  }
  const { runtime } = harness({ staleAfter: 10_000, durableRuntime })
  await runtime.registerWorker({ workerId: 'durable-worker' })
  const event = createRandEvent({ eventId: 'evt_retry_throw', type: 'research.run', source: 'randai', hotelId: 'gio', occurredAt: 7 })
  const job = await runtime.enqueue({ event, handlerId: 'durable', maxAttempts: 2 })
  await assert.rejects(() => runtime.startDurable({ jobId: job.id, workerId: 'durable-worker', workflow: {}, idempotencyKey: 'x' }), /temporary executor failure/)
  const snapshot = await runtime.snapshot()
  assert.equal(snapshot.jobs.counts.RUNNING, 0)
  assert.equal(snapshot.jobs.counts.RETRYING, 1)
})
