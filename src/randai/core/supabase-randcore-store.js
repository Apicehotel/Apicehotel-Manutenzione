const clone = (value) => structuredClone(value)
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

function requireClient(client) {
  if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') throw new TypeError('A server-side Supabase client is required')
  return client
}
function unwrap(result, operation) {
  if (result?.error) {
    const error = new Error(`RandCore store ${operation} failed: ${result.error.message || result.error.code || 'unknown error'}`)
    error.code = result.error.code || 'RANDCORE_STORE_ERROR'; error.cause = result.error; throw error
  }
  return result?.data ?? null
}
function jobToRow(job) { return { id: job.id, event_id: job.eventId, handler_id: job.handlerId, status: job.status, attempt: job.attempt, max_attempts: job.maxAttempts, worker_id: job.workerId ?? null, durable_run_id: job.durableRunId ?? null, error_code: job.errorCode ?? null, metadata: clone(job.metadata ?? {}), output: job.output === undefined ? null : clone(job.output), lease_expires_at: job.leaseExpiresAt ?? null, created_at: job.createdAt, updated_at: job.updatedAt } }
function rowToJob(row, event = null) { if (!row) return null; return { id: row.id, event: event ? clone(event) : undefined, eventId: row.event_id, handlerId: row.handler_id, status: row.status, attempt: row.attempt, maxAttempts: row.max_attempts, workerId: row.worker_id, durableRunId: row.durable_run_id, errorCode: row.error_code, metadata: clone(row.metadata ?? {}), ...(row.output === null || row.output === undefined ? {} : { output: clone(row.output) }), leaseExpiresAt: row.lease_expires_at, createdAt: row.created_at, updatedAt: row.updated_at } }
function eventToRow(event) { return { event_id: event.eventId, type: event.type, source: event.source, scope: event.scope, hotel_id: event.hotelId, occurred_at: event.occurredAt, correlation_id: event.correlationId, causation_id: event.causationId, payload: clone(event.payload ?? {}) } }
function rowToEvent(row) { if (!row) return null; return { eventId: row.event_id, type: row.type, source: row.source, scope: row.scope, hotelId: row.hotel_id, occurredAt: row.occurred_at, correlationId: row.correlation_id, causationId: row.causation_id, payload: clone(row.payload ?? {}) } }
function workerToRow(worker) { return { id: worker.id, capabilities: clone(worker.capabilities ?? []), metadata: clone(worker.metadata ?? {}), registered_at: worker.registeredAt, last_heartbeat_at: worker.lastHeartbeatAt } }
function rowToWorker(row) { if (!row) return null; return { id: row.id, capabilities: clone(row.capabilities ?? []), metadata: clone(row.metadata ?? {}), registeredAt: row.registered_at, lastHeartbeatAt: row.last_heartbeat_at } }
function deadLetterToRow(entry) { return { id: entry.id, job_id: entry.jobId, event_id: entry.eventId, handler_id: entry.handlerId, reason: entry.reason, error_code: entry.errorCode, attempts: entry.attempts, created_at: entry.createdAt } }
function rowToDeadLetter(row) { return { id: row.id, jobId: row.job_id, eventId: row.event_id, handlerId: row.handler_id, reason: row.reason, errorCode: row.error_code, attempts: row.attempts, createdAt: row.created_at } }

export class SupabaseRandCoreStore {
  constructor({ supabase } = {}) { this.supabase = requireClient(supabase) }
  async putEvent(event) {
    unwrap(await this.supabase.from('randcore_events').upsert(eventToRow(event), { onConflict: 'event_id', ignoreDuplicates: true }), 'putEvent.insert')
    const persisted = rowToEvent(unwrap(await this.supabase.from('randcore_events').select('*').eq('event_id', event.eventId).single(), 'putEvent.read'))
    if (!same(persisted, event)) {
      const error = new Error(`RandCore event id collision: ${event.eventId}`); error.code = 'RANDCORE_EVENT_ID_COLLISION'; throw error
    }
    return persisted
  }
  async listEvents() { const rows = unwrap(await this.supabase.from('randcore_events').select('*').order('occurred_at', { ascending: true }), 'listEvents') ?? []; return rows.map(rowToEvent) }
  async getJob(id) { const row = unwrap(await this.supabase.from('randcore_jobs').select('*, randcore_events(*)').eq('id', id).maybeSingle(), 'getJob'); return rowToJob(row, row?.randcore_events ? rowToEvent(row.randcore_events) : null) }
  async putJob(job) { if (job.event) await this.putEvent(job.event); const data = unwrap(await this.supabase.from('randcore_jobs').upsert(jobToRow(job), { onConflict: 'id' }).select().single(), 'putJob'); return rowToJob(data, job.event ?? null) }
  async listJobs() { const rows = unwrap(await this.supabase.from('randcore_jobs').select('*, randcore_events(*)').order('created_at', { ascending: true }), 'listJobs') ?? []; return rows.map((row) => rowToJob(row, row.randcore_events ? rowToEvent(row.randcore_events) : null)) }
  async claimJob({ jobId, workerId, now, leaseExpiresAt }) { const data = unwrap(await this.supabase.rpc('randcore_claim_job', { p_job_id: jobId, p_worker_id: workerId, p_now: now, p_lease_expires_at: leaseExpiresAt }), 'claimJob'); const row = Array.isArray(data) ? data[0] : data; if (!row) throw new Error('Job cannot be claimed'); const event = unwrap(await this.supabase.from('randcore_events').select('*').eq('event_id', row.event_id).single(), 'claimJob.event'); return rowToJob(row, rowToEvent(event)) }
  async renewJobLease({ jobId, workerId, now, leaseExpiresAt }) { const data = unwrap(await this.supabase.rpc('randcore_renew_job_lease', { p_job_id: jobId, p_worker_id: workerId, p_now: now, p_lease_expires_at: leaseExpiresAt }), 'renewJobLease'); const row = Array.isArray(data) ? data[0] : data; if (!row) throw new Error('Job lease cannot be renewed'); return rowToJob(row) }
  async recoverExpiredJobs(now) { const data = unwrap(await this.supabase.rpc('randcore_recover_expired_jobs', { p_now: now }), 'recoverExpiredJobs') ?? []; return (Array.isArray(data) ? data : [data]).filter(Boolean).map((row) => rowToJob(row)) }
  async getWorker(id) { return rowToWorker(unwrap(await this.supabase.from('randcore_workers').select('*').eq('id', id).maybeSingle(), 'getWorker')) }
  async putWorker(worker) { return rowToWorker(unwrap(await this.supabase.from('randcore_workers').upsert(workerToRow(worker), { onConflict: 'id' }).select().single(), 'putWorker')) }
  async listWorkers() { const rows = unwrap(await this.supabase.from('randcore_workers').select('*').order('registered_at', { ascending: true }), 'listWorkers') ?? []; return rows.map(rowToWorker) }
  async putDeadLetter(entry) { const row = unwrap(await this.supabase.from('randcore_dead_letters').upsert(deadLetterToRow(entry), { onConflict: 'job_id,reason', ignoreDuplicates: true }).select().maybeSingle(), 'putDeadLetter'); return row ? rowToDeadLetter(row) : clone(entry) }
  async listDeadLetters() { const rows = unwrap(await this.supabase.from('randcore_dead_letters').select('*').order('created_at', { ascending: true }), 'listDeadLetters') ?? []; return rows.map(rowToDeadLetter) }
}
