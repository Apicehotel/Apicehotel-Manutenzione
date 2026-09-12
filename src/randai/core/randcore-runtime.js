import { RandDurableRuntime, DurableStatus } from './durable-runtime.js'

export const RandJobStatus = Object.freeze({
  QUEUED: 'QUEUED', RUNNING: 'RUNNING', RETRYING: 'RETRYING', SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED', DEAD_LETTER: 'DEAD_LETTER', CANCELLED: 'CANCELLED'
})
export const RandWorkerStatus = Object.freeze({ HEALTHY: 'HEALTHY', STALE: 'STALE' })

const TERMINAL = new Set([RandJobStatus.SUCCEEDED, RandJobStatus.FAILED, RandJobStatus.DEAD_LETTER, RandJobStatus.CANCELLED])
const TRANSITIONS = Object.freeze({
  [RandJobStatus.QUEUED]: new Set([RandJobStatus.RUNNING, RandJobStatus.CANCELLED]),
  [RandJobStatus.RUNNING]: new Set([RandJobStatus.SUCCEEDED, RandJobStatus.RETRYING, RandJobStatus.FAILED, RandJobStatus.DEAD_LETTER, RandJobStatus.CANCELLED]),
  [RandJobStatus.RETRYING]: new Set([RandJobStatus.QUEUED, RandJobStatus.RUNNING, RandJobStatus.DEAD_LETTER, RandJobStatus.CANCELLED]),
  [RandJobStatus.SUCCEEDED]: new Set(), [RandJobStatus.FAILED]: new Set(),
  [RandJobStatus.DEAD_LETTER]: new Set(), [RandJobStatus.CANCELLED]: new Set()
})
const STORE_METHODS = [
  'putEvent','listEvents','getJob','putJob','listJobs','claimJob','renewJobLease','recoverExpiredJobs',
  'getWorker','putWorker','listWorkers','putDeadLetter','listDeadLetters'
]
const clean = (value) => String(value ?? '').trim()
const clone = (value) => structuredClone(value)
const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key])
  return value
}
const frozen = (value) => deepFreeze(clone(value))
const defaultId = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`}`

export function assertRandCoreStore(store) {
  for (const method of STORE_METHODS) if (typeof store?.[method] !== 'function') throw new TypeError(`RandCore store must implement ${method}()`)
  return store
}

export function createRandEvent({ eventId, type, source, hotelId, scope, occurredAt, correlationId, causationId, payload = {} } = {}, { clock = () => Date.now(), idFactory = defaultId } = {}) {
  const normalizedType = clean(type)
  const normalizedSource = clean(source)
  const normalizedHotelId = clean(hotelId)
  const normalizedScope = clean(scope || (normalizedHotelId ? 'HOTEL' : 'SYSTEM')).toUpperCase()
  if (!normalizedType) throw new TypeError('Event type is required')
  if (!normalizedSource) throw new TypeError('Event source is required')
  if (!['HOTEL', 'SYSTEM'].includes(normalizedScope)) throw new TypeError('Event scope must be HOTEL or SYSTEM')
  if (normalizedScope === 'HOTEL' && !normalizedHotelId) throw new TypeError('hotelId is required for HOTEL events')
  if (normalizedScope === 'SYSTEM' && normalizedHotelId) throw new TypeError('SYSTEM events cannot carry hotelId')
  const id = clean(eventId || idFactory('evt'))
  if (!id) throw new TypeError('Event id is required')
  const time = Number(occurredAt ?? clock())
  if (!Number.isFinite(time)) throw new TypeError('Event occurredAt must be a finite timestamp')
  return frozen({ eventId: id, type: normalizedType, source: normalizedSource, scope: normalizedScope,
    hotelId: normalizedHotelId || null, occurredAt: time, correlationId: clean(correlationId || id),
    causationId: clean(causationId) || null, payload: clone(payload) })
}
export function assertRandEvent(event) {
  return createRandEvent(event, { clock: () => event?.occurredAt, idFactory: () => event?.eventId })
}

export class InMemoryRandCoreStore {
  constructor() { this.events = new Map(); this.jobs = new Map(); this.workers = new Map(); this.deadLetters = new Map() }
  async putEvent(event) { this.events.set(event.eventId, clone(event)); return clone(event) }
  async listEvents() { return [...this.events.values()].map(clone) }
  async getJob(id) { return clone(this.jobs.get(id) ?? null) }
  async putJob(job) { if (job.event) await this.putEvent(job.event); this.jobs.set(job.id, clone(job)); return clone(job) }
  async listJobs() { return [...this.jobs.values()].map(clone) }
  async claimJob({ jobId, workerId, now, leaseExpiresAt }) {
    const job = this.jobs.get(jobId)
    if (!job || ![RandJobStatus.QUEUED, RandJobStatus.RETRYING].includes(job.status)) throw new Error('Job cannot be claimed')
    job.status = RandJobStatus.RUNNING; job.workerId = workerId; job.attempt += 1; job.leaseExpiresAt = leaseExpiresAt; job.updatedAt = now
    this.jobs.set(job.id, clone(job)); return clone(job)
  }
  async renewJobLease({ jobId, workerId, now, leaseExpiresAt }) {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== RandJobStatus.RUNNING || job.workerId !== workerId || job.leaseExpiresAt == null || job.leaseExpiresAt <= now) throw new Error('Job lease cannot be renewed')
    job.leaseExpiresAt = leaseExpiresAt; job.updatedAt = now; this.jobs.set(job.id, clone(job)); return clone(job)
  }
  async recoverExpiredJobs(now) {
    const recovered = []
    for (const job of this.jobs.values()) {
      if (job.status !== RandJobStatus.RUNNING || job.leaseExpiresAt == null || job.leaseExpiresAt > now) continue
      job.workerId = null; job.leaseExpiresAt = null; job.errorCode = 'LEASE_EXPIRED'; job.updatedAt = now
      if (job.attempt < job.maxAttempts) job.status = RandJobStatus.RETRYING
      else {
        job.status = RandJobStatus.DEAD_LETTER
        await this.putDeadLetter({ id: `dlq_lease_${job.id}`, jobId: job.id, eventId: job.eventId, handlerId: job.handlerId,
          reason: 'LEASE_EXPIRED_RETRY_EXHAUSTED', errorCode: 'LEASE_EXPIRED', attempts: job.attempt, createdAt: now })
      }
      this.jobs.set(job.id, clone(job)); recovered.push(clone(job))
    }
    return recovered
  }
  async getWorker(id) { return clone(this.workers.get(id) ?? null) }
  async putWorker(worker) { this.workers.set(worker.id, clone(worker)); return clone(worker) }
  async listWorkers() { return [...this.workers.values()].map(clone) }
  async putDeadLetter(entry) {
    const key = `${entry.jobId}:${entry.reason}`
    if (![...this.deadLetters.values()].some((item) => `${item.jobId}:${item.reason}` === key)) this.deadLetters.set(entry.id, clone(entry))
    return clone(entry)
  }
  async listDeadLetters() { return [...this.deadLetters.values()].map(clone) }
}

export class RandCoreRuntime {
  constructor({ store = new InMemoryRandCoreStore(), durableRuntime = new RandDurableRuntime(), clock = () => Date.now(),
    idFactory = defaultId, workerStaleAfterMs = 60_000, jobLeaseMs = 60_000 } = {}) {
    this.store = assertRandCoreStore(store); this.durableRuntime = durableRuntime; this.clock = clock; this.idFactory = idFactory
    this.workerStaleAfterMs = Math.max(1, Number(workerStaleAfterMs) || 60_000)
    this.jobLeaseMs = Math.max(1, Number(jobLeaseMs) || 60_000)
  }

  async publish({ event, routes = [] } = {}) {
    const normalizedEvent = assertRandEvent(event)
    if (!Array.isArray(routes) || routes.length === 0) throw new TypeError('At least one event route is required')
    await this.store.putEvent(normalizedEvent)
    const jobs = []
    for (const route of routes) jobs.push(await this.enqueue({ event: normalizedEvent, handlerId: route?.handlerId, maxAttempts: route?.maxAttempts, metadata: route?.metadata ?? {} }))
    return frozen({ event: normalizedEvent, jobs })
  }

  async enqueue({ event, handlerId, maxAttempts = 3, metadata = {} } = {}) {
    const normalizedEvent = assertRandEvent(event); const handler = clean(handlerId)
    if (!handler) throw new TypeError('handlerId is required')
    const now = this.clock()
    const job = { id: this.idFactory('job'), event: normalizedEvent, eventId: normalizedEvent.eventId, handlerId: handler,
      status: RandJobStatus.QUEUED, attempt: 0, maxAttempts: Math.max(1, Number(maxAttempts) || 3), workerId: null,
      durableRunId: null, errorCode: null, metadata: clone(metadata), leaseExpiresAt: null, createdAt: now, updatedAt: now }
    await this.store.putEvent(normalizedEvent); await this.store.putJob(job); return frozen(job)
  }

  async registerWorker({ workerId, capabilities = [], metadata = {} } = {}) {
    const id = clean(workerId); if (!id) throw new TypeError('workerId is required')
    const now = this.clock(); const existing = await this.store.getWorker(id)
    const worker = { id, capabilities: [...new Set(capabilities.map(clean).filter(Boolean))], metadata: clone(metadata),
      registeredAt: existing?.registeredAt ?? now, lastHeartbeatAt: now }
    await this.store.putWorker(worker); return frozen(worker)
  }
  async heartbeat(workerId) {
    const worker = await this.store.getWorker(clean(workerId)); if (!worker) throw new Error('Worker not registered')
    worker.lastHeartbeatAt = this.clock(); await this.store.putWorker(worker); return frozen(worker)
  }
  async workerHealth(workerId) {
    const worker = await this.store.getWorker(clean(workerId)); if (!worker) return null
    const ageMs = Math.max(0, this.clock() - worker.lastHeartbeatAt)
    return frozen({ workerId: worker.id, status: ageMs > this.workerStaleAfterMs ? RandWorkerStatus.STALE : RandWorkerStatus.HEALTHY, ageMs, lastHeartbeatAt: worker.lastHeartbeatAt })
  }

  async claim({ jobId, workerId } = {}) {
    const worker = await this.store.getWorker(clean(workerId)); if (!worker) throw new Error('Worker not registered')
    const health = await this.workerHealth(worker.id); if (health.status !== RandWorkerStatus.HEALTHY) throw new Error('Worker is stale')
    const now = this.clock()
    return frozen(await this.store.claimJob({ jobId: clean(jobId), workerId: worker.id, now, leaseExpiresAt: now + this.jobLeaseMs }))
  }
  async renewLease(jobId, workerId) {
    const now = this.clock()
    return frozen(await this.store.renewJobLease({ jobId: clean(jobId), workerId: clean(workerId), now, leaseExpiresAt: now + this.jobLeaseMs }))
  }
  async recoverExpiredJobs() { return frozen(await this.store.recoverExpiredJobs(this.clock())) }

  async succeed(jobId, output = null) {
    const job = await this.#requiredJob(jobId); this.#transition(job, RandJobStatus.SUCCEEDED)
    job.output = clone(output); job.errorCode = null; job.leaseExpiresAt = null; await this.store.putJob(job); return frozen(job)
  }
  async fail(jobId, { retryable = false, errorCode = 'JOB_FAILED' } = {}) {
    const job = await this.#requiredJob(jobId); if (job.status !== RandJobStatus.RUNNING) throw new Error(`Job cannot fail from ${job.status}`)
    job.errorCode = clean(errorCode || 'JOB_FAILED'); job.leaseExpiresAt = null
    if (retryable && job.attempt < job.maxAttempts) {
      this.#transition(job, RandJobStatus.RETRYING); job.workerId = null; await this.store.putJob(job); return frozen(job)
    }
    if (retryable) {
      this.#transition(job, RandJobStatus.DEAD_LETTER); await this.store.putJob(job); await this.#deadLetter(job, 'RETRY_EXHAUSTED'); return frozen(job)
    }
    this.#transition(job, RandJobStatus.FAILED); await this.store.putJob(job); return frozen(job)
  }
  async requeue(jobId) {
    const job = await this.#requiredJob(jobId); this.#transition(job, RandJobStatus.QUEUED); job.workerId = null; job.leaseExpiresAt = null
    await this.store.putJob(job); return frozen(job)
  }
  async cancel(jobId) {
    const job = await this.#requiredJob(jobId); if (TERMINAL.has(job.status)) return frozen(job)
    this.#transition(job, RandJobStatus.CANCELLED); job.leaseExpiresAt = null; await this.store.putJob(job); return frozen(job)
  }

  async startDurable({ jobId, workerId, workflow, input = {}, context = {}, idempotencyKey, maxAttempts = 3 } = {}) {
    const claimed = await this.claim({ jobId, workerId })
    try {
      const run = await this.durableRuntime.start({ workflow, input, context, idempotencyKey, maxAttempts })
      await this.#bindDurableRun(claimed.id, run); return this.#syncDurableResult(claimed.id, run)
    } catch (error) { await this.#recordDurableException(claimed.id, error); throw error }
  }
  async resumeDurable({ jobId, workflow, context = {}, workerId } = {}) {
    let job = await this.#requiredJob(jobId)
    if (job.status === RandJobStatus.RETRYING) job = await this.claim({ jobId, workerId })
    if (job.status !== RandJobStatus.RUNNING) throw new Error(`Durable job cannot resume from ${job.status}`)
    if (!job.durableRunId) throw new Error('Durable run is not bound to job')
    if (workerId && job.workerId === clean(workerId)) await this.renewLease(job.id, workerId)
    try {
      const run = await this.durableRuntime.resume({ runId: job.durableRunId, workflow, context })
      return this.#syncDurableResult(job.id, run)
    } catch (error) { await this.#recordDurableException(job.id, error); throw error }
  }

  async snapshot() {
    const [events, jobs, workers, deadLetters] = await Promise.all([this.store.listEvents(), this.store.listJobs(), this.store.listWorkers(), this.store.listDeadLetters()])
    const counts = Object.fromEntries(Object.values(RandJobStatus).map((status) => [status, 0])); for (const job of jobs) counts[job.status] = (counts[job.status] ?? 0) + 1
    const workerHealth = []; for (const worker of workers) workerHealth.push(await this.workerHealth(worker.id))
    return frozen({ generatedAt: this.clock(), events: { total: events.length }, jobs: { total: jobs.length, counts },
      workers: { total: workers.length, healthy: workerHealth.filter((x) => x.status === RandWorkerStatus.HEALTHY).length,
        stale: workerHealth.filter((x) => x.status === RandWorkerStatus.STALE).length, items: workerHealth },
      deadLetters: { total: deadLetters.length, items: deadLetters } })
  }

  async #requiredJob(jobId) { const job = await this.store.getJob(clean(jobId)); if (!job) throw new Error('Job not found'); return job }
  #transition(job, nextStatus) {
    const allowed = TRANSITIONS[job.status]; if (!allowed?.has(nextStatus)) throw new Error(`Invalid job transition ${job.status} -> ${nextStatus}`)
    job.status = nextStatus; job.updatedAt = this.clock()
  }
  async #bindDurableRun(jobId, run) {
    if (!run?.id) return; const job = await this.#requiredJob(jobId); job.durableRunId = run.id; job.updatedAt = this.clock(); await this.store.putJob(job)
  }
  async #syncDurableResult(jobId, run) {
    if (run?.status === DurableStatus.SUCCEEDED) return { job: await this.succeed(jobId, run.output ?? null), run }
    if (run?.status === DurableStatus.FAILED || run?.status === 'DENIED') return { job: await this.fail(jobId, { retryable: false, errorCode: run.errorCode || run.authorization?.code || 'DURABLE_FAILED' }), run }
    if (run?.status === DurableStatus.CANCELLED) return { job: await this.cancel(jobId), run }
    return { job: frozen(await this.#requiredJob(jobId)), run }
  }
  async #recordDurableException(jobId, error) {
    const job = await this.#requiredJob(jobId); if (job.status !== RandJobStatus.RUNNING) return frozen(job)
    return this.fail(jobId, { retryable: error?.retryable === true, errorCode: clean(error?.code || 'DURABLE_RUNTIME_EXCEPTION') })
  }
  async #deadLetter(job, reason) {
    const entry = { id: this.idFactory('dlq'), jobId: job.id, eventId: job.eventId, handlerId: job.handlerId,
      reason, errorCode: job.errorCode, attempts: job.attempt, createdAt: this.clock() }
    await this.store.putDeadLetter(entry); return frozen(entry)
  }
}
