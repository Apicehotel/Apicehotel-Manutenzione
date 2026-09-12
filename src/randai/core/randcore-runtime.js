import { RandDurableRuntime, DurableStatus } from './durable-runtime.js'

export const RandJobStatus = Object.freeze({
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  RETRYING: 'RETRYING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  DEAD_LETTER: 'DEAD_LETTER',
  CANCELLED: 'CANCELLED'
})

export const RandWorkerStatus = Object.freeze({ HEALTHY: 'HEALTHY', STALE: 'STALE' })

const TERMINAL = new Set([
  RandJobStatus.SUCCEEDED,
  RandJobStatus.FAILED,
  RandJobStatus.DEAD_LETTER,
  RandJobStatus.CANCELLED
])

const TRANSITIONS = Object.freeze({
  [RandJobStatus.QUEUED]: new Set([RandJobStatus.RUNNING, RandJobStatus.CANCELLED]),
  [RandJobStatus.RUNNING]: new Set([RandJobStatus.SUCCEEDED, RandJobStatus.RETRYING, RandJobStatus.FAILED, RandJobStatus.DEAD_LETTER, RandJobStatus.CANCELLED]),
  [RandJobStatus.RETRYING]: new Set([RandJobStatus.QUEUED, RandJobStatus.RUNNING, RandJobStatus.DEAD_LETTER, RandJobStatus.CANCELLED]),
  [RandJobStatus.SUCCEEDED]: new Set(),
  [RandJobStatus.FAILED]: new Set(),
  [RandJobStatus.DEAD_LETTER]: new Set(),
  [RandJobStatus.CANCELLED]: new Set()
})

const clean = (value) => String(value ?? '').trim()
const clone = (value) => structuredClone(value)
const frozen = (value) => Object.freeze(clone(value))
const defaultId = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`}`

export function createRandEvent({
  eventId,
  type,
  source,
  hotelId,
  scope,
  occurredAt,
  correlationId,
  causationId,
  payload = {}
} = {}, { clock = () => Date.now(), idFactory = defaultId } = {}) {
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
  return frozen({
    eventId: id,
    type: normalizedType,
    source: normalizedSource,
    scope: normalizedScope,
    hotelId: normalizedHotelId || null,
    occurredAt: time,
    correlationId: clean(correlationId || id),
    causationId: clean(causationId) || null,
    payload: clone(payload)
  })
}

export function assertRandEvent(event) {
  return createRandEvent(event, {
    clock: () => event?.occurredAt,
    idFactory: () => event?.eventId
  })
}

export class InMemoryRandCoreStore {
  constructor() {
    this.jobs = new Map()
    this.workers = new Map()
    this.deadLetters = new Map()
  }
  async getJob(id) { return clone(this.jobs.get(id) ?? null) }
  async putJob(job) { this.jobs.set(job.id, clone(job)); return clone(job) }
  async listJobs() { return [...this.jobs.values()].map(clone) }
  async getWorker(id) { return clone(this.workers.get(id) ?? null) }
  async putWorker(worker) { this.workers.set(worker.id, clone(worker)); return clone(worker) }
  async listWorkers() { return [...this.workers.values()].map(clone) }
  async putDeadLetter(entry) { this.deadLetters.set(entry.id, clone(entry)); return clone(entry) }
  async listDeadLetters() { return [...this.deadLetters.values()].map(clone) }
}

export class RandCoreRuntime {
  constructor({
    store = new InMemoryRandCoreStore(),
    durableRuntime = new RandDurableRuntime(),
    clock = () => Date.now(),
    idFactory = defaultId,
    workerStaleAfterMs = 60_000
  } = {}) {
    this.store = store
    this.durableRuntime = durableRuntime
    this.clock = clock
    this.idFactory = idFactory
    this.workerStaleAfterMs = Math.max(1, Number(workerStaleAfterMs) || 60_000)
  }

  async enqueue({ event, handlerId, maxAttempts = 3, metadata = {} } = {}) {
    const normalizedEvent = assertRandEvent(event)
    const handler = clean(handlerId)
    if (!handler) throw new TypeError('handlerId is required')
    const now = this.clock()
    const job = {
      id: this.idFactory('job'),
      event: normalizedEvent,
      eventId: normalizedEvent.eventId,
      handlerId: handler,
      status: RandJobStatus.QUEUED,
      attempt: 0,
      maxAttempts: Math.max(1, Number(maxAttempts) || 3),
      workerId: null,
      durableRunId: null,
      errorCode: null,
      metadata: clone(metadata),
      createdAt: now,
      updatedAt: now
    }
    await this.store.putJob(job)
    return frozen(job)
  }

  async registerWorker({ workerId, capabilities = [], metadata = {} } = {}) {
    const id = clean(workerId)
    if (!id) throw new TypeError('workerId is required')
    const now = this.clock()
    const worker = {
      id,
      capabilities: [...new Set(capabilities.map(clean).filter(Boolean))],
      metadata: clone(metadata),
      registeredAt: now,
      lastHeartbeatAt: now
    }
    await this.store.putWorker(worker)
    return frozen(worker)
  }

  async heartbeat(workerId) {
    const id = clean(workerId)
    const worker = await this.store.getWorker(id)
    if (!worker) throw new Error('Worker not registered')
    worker.lastHeartbeatAt = this.clock()
    await this.store.putWorker(worker)
    return frozen(worker)
  }

  async workerHealth(workerId) {
    const worker = await this.store.getWorker(clean(workerId))
    if (!worker) return null
    const ageMs = Math.max(0, this.clock() - worker.lastHeartbeatAt)
    return frozen({
      workerId: worker.id,
      status: ageMs > this.workerStaleAfterMs ? RandWorkerStatus.STALE : RandWorkerStatus.HEALTHY,
      ageMs,
      lastHeartbeatAt: worker.lastHeartbeatAt
    })
  }

  async claim({ jobId, workerId } = {}) {
    const worker = await this.store.getWorker(clean(workerId))
    if (!worker) throw new Error('Worker not registered')
    const health = await this.workerHealth(worker.id)
    if (health.status !== RandWorkerStatus.HEALTHY) throw new Error('Worker is stale')
    const job = await this.#requiredJob(jobId)
    if (![RandJobStatus.QUEUED, RandJobStatus.RETRYING].includes(job.status)) throw new Error(`Job cannot be claimed from ${job.status}`)
    this.#transition(job, RandJobStatus.RUNNING)
    job.workerId = worker.id
    job.attempt += 1
    await this.store.putJob(job)
    return frozen(job)
  }

  async succeed(jobId, output = null) {
    const job = await this.#requiredJob(jobId)
    this.#transition(job, RandJobStatus.SUCCEEDED)
    job.output = clone(output)
    job.errorCode = null
    await this.store.putJob(job)
    return frozen(job)
  }

  async fail(jobId, { retryable = false, errorCode = 'JOB_FAILED' } = {}) {
    const job = await this.#requiredJob(jobId)
    if (job.status !== RandJobStatus.RUNNING) throw new Error(`Job cannot fail from ${job.status}`)
    job.errorCode = clean(errorCode || 'JOB_FAILED')
    if (retryable && job.attempt < job.maxAttempts) {
      this.#transition(job, RandJobStatus.RETRYING)
      await this.store.putJob(job)
      return frozen(job)
    }
    if (retryable) {
      this.#transition(job, RandJobStatus.DEAD_LETTER)
      await this.store.putJob(job)
      await this.#deadLetter(job, 'RETRY_EXHAUSTED')
      return frozen(job)
    }
    this.#transition(job, RandJobStatus.FAILED)
    await this.store.putJob(job)
    return frozen(job)
  }

  async requeue(jobId) {
    const job = await this.#requiredJob(jobId)
    this.#transition(job, RandJobStatus.QUEUED)
    job.workerId = null
    await this.store.putJob(job)
    return frozen(job)
  }

  async cancel(jobId) {
    const job = await this.#requiredJob(jobId)
    if (TERMINAL.has(job.status)) return frozen(job)
    this.#transition(job, RandJobStatus.CANCELLED)
    await this.store.putJob(job)
    return frozen(job)
  }

  async startDurable({ jobId, workerId, workflow, input = {}, context = {}, idempotencyKey, maxAttempts = 3 } = {}) {
    const claimed = await this.claim({ jobId, workerId })
    const run = await this.durableRuntime.start({ workflow, input, context, idempotencyKey, maxAttempts })
    const job = await this.#requiredJob(claimed.id)
    if (run?.id) job.durableRunId = run.id
    await this.store.putJob(job)
    if (run?.status === DurableStatus.SUCCEEDED) return { job: await this.succeed(job.id, run.output ?? null), run }
    if (run?.status === DurableStatus.FAILED || run?.status === 'DENIED') return { job: await this.fail(job.id, { retryable: false, errorCode: run.errorCode || run.authorization?.code || 'DURABLE_FAILED' }), run }
    if (run?.status === DurableStatus.CANCELLED) return { job: await this.cancel(job.id), run }
    return { job: frozen(job), run }
  }

  async snapshot() {
    const jobs = await this.store.listJobs()
    const workers = await this.store.listWorkers()
    const deadLetters = await this.store.listDeadLetters()
    const counts = Object.fromEntries(Object.values(RandJobStatus).map((status) => [status, 0]))
    for (const job of jobs) counts[job.status] = (counts[job.status] ?? 0) + 1
    const workerHealth = []
    for (const worker of workers) workerHealth.push(await this.workerHealth(worker.id))
    return frozen({
      generatedAt: this.clock(),
      jobs: { total: jobs.length, counts },
      workers: {
        total: workers.length,
        healthy: workerHealth.filter((item) => item.status === RandWorkerStatus.HEALTHY).length,
        stale: workerHealth.filter((item) => item.status === RandWorkerStatus.STALE).length,
        items: workerHealth
      },
      deadLetters: { total: deadLetters.length, items: deadLetters }
    })
  }

  async #requiredJob(jobId) {
    const job = await this.store.getJob(clean(jobId))
    if (!job) throw new Error('Job not found')
    return job
  }

  #transition(job, nextStatus) {
    const allowed = TRANSITIONS[job.status]
    if (!allowed?.has(nextStatus)) throw new Error(`Invalid job transition ${job.status} -> ${nextStatus}`)
    job.status = nextStatus
    job.updatedAt = this.clock()
  }

  async #deadLetter(job, reason) {
    const entry = {
      id: this.idFactory('dlq'),
      jobId: job.id,
      eventId: job.eventId,
      handlerId: job.handlerId,
      reason,
      errorCode: job.errorCode,
      attempts: job.attempt,
      createdAt: this.clock()
    }
    await this.store.putDeadLetter(entry)
    return frozen(entry)
  }
}
