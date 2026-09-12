import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  InMemoryRandCoreStore,
  RandCoreRuntime,
  RandJobStatus,
  RandWorkerStatus,
  createRandEvent
} from '../src/randai/core/randcore-runtime.js'
import { SupabaseRandCoreStore } from '../src/randai/core/supabase-randcore-store.js'

function harness({ now = 1_000, staleAfter = 100, durableRuntime, store = new InMemoryRandCoreStore(), leaseMs = 1_000 } = {}) {
  let clockValue = now
  let id = 0
  const runtime = new RandCoreRuntime({
    store,
    ...(durableRuntime ? { durableRuntime } : {}),
    clock: () => clockValue,
    idFactory: (prefix) => `${prefix}_${++id}`,
    workerStaleAfterMs: staleAfter,
    jobLeaseMs: leaseMs
  })
  return { runtime, store, tick: (ms) => { clockValue += ms }, now: () => clockValue }
}

test('event envelope is deeply immutable, correlated and hotel-scoped by default', () => {
  const event = createRandEvent({ eventId: 'evt_1', type: 'maintenance.created', source: 'randapp', hotelId: 'gio', occurredAt: 123, payload: { urgent: true, nested: { room: 214 } } })
  assert.equal(event.scope, 'HOTEL'); assert.equal(event.hotelId, 'gio'); assert.equal(event.correlationId, 'evt_1'); assert.equal(event.causationId, null)
  assert.throws(() => { event.type = 'tampered' }, TypeError)
  assert.throws(() => { event.payload.urgent = false }, TypeError)
  assert.throws(() => { event.payload.nested.room = 999 }, TypeError)
})

test('event envelope fails closed on invalid hotel/system scope', () => {
  assert.throws(() => createRandEvent({ type: 'x', source: 'test', scope: 'HOTEL' }), /hotelId/)
  assert.throws(() => createRandEvent({ type: 'x', source: 'test', scope: 'SYSTEM', hotelId: 'gio' }), /SYSTEM/)
  assert.throws(() => createRandEvent({ source: 'test' }), /type/)
})

test('publish fans one persisted event out to independent correlated jobs', async () => {
  const { runtime } = harness()
  const event = createRandEvent({ eventId: 'evt_fanout', type: 'maintenance.created', source: 'randapp', hotelId: 'gio', occurredAt: 1 })
  const published = await runtime.publish({ event, routes: [{ handlerId: 'notify-reception' }, { handlerId: 'notify-maintenance', maxAttempts: 5 }] })
  assert.equal(published.jobs.length, 2); assert.notEqual(published.jobs[0].id, published.jobs[1].id)
  assert.equal(published.jobs[0].eventId, 'evt_fanout'); assert.equal(published.jobs[1].event.correlationId, 'evt_fanout'); assert.equal(published.jobs[1].maxAttempts, 5)
  assert.equal((await runtime.snapshot()).events.total, 1)
})

test('job lifecycle is explicit and invalid transitions fail closed', async () => {
  const { runtime } = harness(); const event = createRandEvent({ eventId: 'evt_1', type: 'maintenance.created', source: 'randapp', hotelId: 'gio', occurredAt: 1 })
  await runtime.registerWorker({ workerId: 'worker-a', capabilities: ['notify'] })
  const queued = await runtime.enqueue({ event, handlerId: 'notify', maxAttempts: 2 }); assert.equal(queued.status, RandJobStatus.QUEUED)
  const running = await runtime.claim({ jobId: queued.id, workerId: 'worker-a' }); assert.equal(running.status, RandJobStatus.RUNNING); assert.equal(running.attempt, 1); assert.ok(running.leaseExpiresAt)
  const done = await runtime.succeed(running.id, { delivered: true }); assert.equal(done.status, RandJobStatus.SUCCEEDED); assert.equal(done.leaseExpiresAt, null)
  await assert.rejects(() => runtime.succeed(done.id), /Invalid job transition/)
})

test('retry exhaustion enters dead-letter exactly once', async () => {
  const { runtime } = harness(); const event = createRandEvent({ eventId: 'evt_retry', type: 'notification.send', source: 'randcore', hotelId: 'gio', occurredAt: 1 })
  await runtime.registerWorker({ workerId: 'worker-a' }); const queued = await runtime.enqueue({ event, handlerId: 'notify', maxAttempts: 2 })
  await runtime.claim({ jobId: queued.id, workerId: 'worker-a' }); assert.equal((await runtime.fail(queued.id, { retryable: true, errorCode: 'PROVIDER_DOWN' })).status, RandJobStatus.RETRYING)
  await runtime.requeue(queued.id); await runtime.claim({ jobId: queued.id, workerId: 'worker-a' })
  assert.equal((await runtime.fail(queued.id, { retryable: true, errorCode: 'PROVIDER_DOWN' })).status, RandJobStatus.DEAD_LETTER)
  const snapshot = await runtime.snapshot(); assert.equal(snapshot.deadLetters.total, 1); assert.equal(snapshot.deadLetters.items[0].reason, 'RETRY_EXHAUSTED'); assert.equal(snapshot.jobs.counts.DEAD_LETTER, 1)
})

test('worker heartbeat detects stale workers and blocks claim', async () => {
  const { runtime, tick } = harness({ staleAfter: 100 }); await runtime.registerWorker({ workerId: 'worker-a' }); assert.equal((await runtime.workerHealth('worker-a')).status, RandWorkerStatus.HEALTHY)
  tick(101); assert.equal((await runtime.workerHealth('worker-a')).status, RandWorkerStatus.STALE)
  const event = createRandEvent({ eventId: 'evt_2', type: 'repo.scan', source: 'randradar', scope: 'SYSTEM', occurredAt: 2 }); const queued = await runtime.enqueue({ event, handlerId: 'radar' })
  await assert.rejects(() => runtime.claim({ jobId: queued.id, workerId: 'worker-a' }), /stale/); await runtime.heartbeat('worker-a')
  assert.equal((await runtime.claim({ jobId: queued.id, workerId: 'worker-a' })).status, RandJobStatus.RUNNING)
})

test('snapshot exposes observable queue and worker health without treating stale as healthy', async () => {
  const { runtime, tick } = harness({ staleAfter: 100 }); await runtime.registerWorker({ workerId: 'healthy' }); tick(80); await runtime.registerWorker({ workerId: 'fresh' }); tick(30)
  const event = createRandEvent({ eventId: 'evt_3', type: 'core.health', source: 'randcore', scope: 'SYSTEM', occurredAt: 3 }); await runtime.enqueue({ event, handlerId: 'health' })
  const snapshot = await runtime.snapshot(); assert.equal(snapshot.jobs.total, 1); assert.equal(snapshot.jobs.counts.QUEUED, 1); assert.equal(snapshot.workers.total, 2); assert.equal(snapshot.workers.stale, 1); assert.equal(snapshot.workers.healthy, 1)
  assert.throws(() => { snapshot.jobs.counts.QUEUED = 99 }, TypeError)
})

test('non-retryable failure is terminal FAILED and does not silently requeue', async () => {
  const { runtime } = harness(); await runtime.registerWorker({ workerId: 'worker-a' })
  const event = createRandEvent({ eventId: 'evt_4', type: 'procedure.publish', source: 'procedures', hotelId: 'gio', occurredAt: 4 }); const job = await runtime.enqueue({ event, handlerId: 'publish' })
  await runtime.claim({ jobId: job.id, workerId: 'worker-a' }); assert.equal((await runtime.fail(job.id, { retryable: false, errorCode: 'POLICY_DENIED' })).status, RandJobStatus.FAILED)
  await assert.rejects(() => runtime.requeue(job.id), /Invalid job transition/)
})

test('durable start and resume stay synchronized with one RandCore job', async () => {
  const { runtime } = harness({ staleAfter: 10_000 }); await runtime.registerWorker({ workerId: 'durable-worker' })
  const event = createRandEvent({ eventId: 'evt_durable', type: 'research.run', source: 'randai', hotelId: 'gio', occurredAt: 5 }); const job = await runtime.enqueue({ event, handlerId: 'durable' })
  let calls = 0; const workflow = { id: 'research', version: '1', async execute() { calls += 1; if (calls === 1) return { wait: true, checkpoint: { step: 1 } }; return { output: { complete: true } } } }
  const context = { actor: { id: 'u1' }, hotelId: 'gio', targetHotelId: 'gio', grantedScopes: ['workflow:execute'] }
  const started = await runtime.startDurable({ jobId: job.id, workerId: 'durable-worker', workflow, context, idempotencyKey: 'research-1' }); assert.equal(started.job.status, RandJobStatus.RUNNING); assert.ok(started.job.durableRunId)
  const resumed = await runtime.resumeDurable({ jobId: job.id, workflow, context, workerId: 'durable-worker' }); assert.equal(resumed.job.status, RandJobStatus.SUCCEEDED); assert.deepEqual(resumed.job.output, { complete: true }); assert.equal(calls, 2)
})

test('durable start exception cannot strand a job in RUNNING', async () => {
  const durableRuntime = { async start() { const error = new Error('executor unavailable'); error.code = 'EXECUTOR_DOWN'; throw error } }
  const { runtime } = harness({ staleAfter: 10_000, durableRuntime }); await runtime.registerWorker({ workerId: 'durable-worker' })
  const event = createRandEvent({ eventId: 'evt_throw', type: 'research.run', source: 'randai', hotelId: 'gio', occurredAt: 6 }); const job = await runtime.enqueue({ event, handlerId: 'durable' })
  await assert.rejects(() => runtime.startDurable({ jobId: job.id, workerId: 'durable-worker', workflow: {}, idempotencyKey: 'x' }), /executor unavailable/)
  const snapshot = await runtime.snapshot(); assert.equal(snapshot.jobs.counts.RUNNING, 0); assert.equal(snapshot.jobs.counts.FAILED, 1)
})

test('retryable durable exception moves job to RETRYING instead of stranding it', async () => {
  const durableRuntime = { async start() { const error = new Error('temporary executor failure'); error.code = 'EXECUTOR_TEMPORARY'; error.retryable = true; throw error } }
  const { runtime } = harness({ staleAfter: 10_000, durableRuntime }); await runtime.registerWorker({ workerId: 'durable-worker' })
  const event = createRandEvent({ eventId: 'evt_retry_throw', type: 'research.run', source: 'randai', hotelId: 'gio', occurredAt: 7 }); const job = await runtime.enqueue({ event, handlerId: 'durable', maxAttempts: 2 })
  await assert.rejects(() => runtime.startDurable({ jobId: job.id, workerId: 'durable-worker', workflow: {}, idempotencyKey: 'x' }), /temporary executor failure/)
  const snapshot = await runtime.snapshot(); assert.equal(snapshot.jobs.counts.RUNNING, 0); assert.equal(snapshot.jobs.counts.RETRYING, 1)
})

test('lease renewal is owner-bound and prevents premature recovery', async () => {
  const { runtime, tick } = harness({ leaseMs: 100, staleAfter: 1_000 }); await runtime.registerWorker({ workerId: 'worker-a' }); await runtime.registerWorker({ workerId: 'worker-b' })
  const event = createRandEvent({ eventId: 'evt_lease', type: 'core.long-job', source: 'randcore', scope: 'SYSTEM', occurredAt: 8 }); const job = await runtime.enqueue({ event, handlerId: 'long' })
  await runtime.claim({ jobId: job.id, workerId: 'worker-a' }); tick(50); await assert.rejects(() => runtime.renewLease(job.id, 'worker-b'), /lease/i); await runtime.renewLease(job.id, 'worker-a')
  tick(60); assert.deepEqual(await runtime.recoverExpiredJobs(), []); assert.equal((await runtime.snapshot()).jobs.counts.RUNNING, 1)
})

test('a fresh runtime recovers an expired claimed job from the shared persistent store', async () => {
  const store = new InMemoryRandCoreStore(); let now = 1_000
  const runtimeA = new RandCoreRuntime({ store, clock: () => now, idFactory: (p) => `${p}_a`, workerStaleAfterMs: 1_000, jobLeaseMs: 100 })
  await runtimeA.registerWorker({ workerId: 'worker-a' }); const event = createRandEvent({ eventId: 'evt_restart', type: 'notification.send', source: 'randcore', hotelId: 'gio', occurredAt: 9 })
  const job = await runtimeA.enqueue({ event, handlerId: 'notify', maxAttempts: 2 }); await runtimeA.claim({ jobId: job.id, workerId: 'worker-a' })
  now = 1_101
  const runtimeB = new RandCoreRuntime({ store, clock: () => now, idFactory: (p) => `${p}_b`, workerStaleAfterMs: 1_000, jobLeaseMs: 100 })
  const recovered = await runtimeB.recoverExpiredJobs(); assert.equal(recovered.length, 1); assert.equal(recovered[0].status, RandJobStatus.RETRYING); assert.equal(recovered[0].errorCode, 'LEASE_EXPIRED')
  assert.equal((await runtimeB.snapshot()).jobs.counts.RUNNING, 0)
})

test('expired final attempt becomes one persistent dead-letter and recovery is idempotent', async () => {
  const { runtime, tick } = harness({ leaseMs: 100, staleAfter: 1_000 }); await runtime.registerWorker({ workerId: 'worker-a' })
  const event = createRandEvent({ eventId: 'evt_dead_restart', type: 'notification.send', source: 'randcore', hotelId: 'gio', occurredAt: 10 }); const job = await runtime.enqueue({ event, handlerId: 'notify', maxAttempts: 1 })
  await runtime.claim({ jobId: job.id, workerId: 'worker-a' }); tick(101); const recovered = await runtime.recoverExpiredJobs(); assert.equal(recovered[0].status, RandJobStatus.DEAD_LETTER)
  await runtime.recoverExpiredJobs(); const snapshot = await runtime.snapshot(); assert.equal(snapshot.deadLetters.total, 1); assert.equal(snapshot.jobs.counts.DEAD_LETTER, 1)
})

test('Supabase production store requires a server client and exposes the complete persistent contract', () => {
  assert.throws(() => new SupabaseRandCoreStore(), /server-side Supabase client/)
  const fake = { from() {}, rpc() {} }; const store = new SupabaseRandCoreStore({ supabase: fake })
  for (const method of ['putEvent','listEvents','getJob','putJob','listJobs','claimJob','renewJobLease','recoverExpiredJobs','getWorker','putWorker','listWorkers','putDeadLetter','listDeadLetters']) assert.equal(typeof store[method], 'function')
})

test('database migration locks RandCore persistence to service_role and implements atomic recovery', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20260912113000_randcore_runtime_v2_persistence.sql', import.meta.url), 'utf8')
  for (const table of ['randcore_events','randcore_jobs','randcore_workers','randcore_dead_letters']) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  assert.match(sql, /for update skip locked/i); assert.match(sql, /randcore_claim_job/i); assert.match(sql, /randcore_renew_job_lease/i); assert.match(sql, /randcore_recover_expired_jobs/i)
  assert.match(sql, /revoke all on function public\.randcore_claim_job[\s\S]*from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.randcore_claim_job[\s\S]*to service_role/i)
})
