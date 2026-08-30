const clone = (value) => structuredClone(value)
const TERMINAL_TASK_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])

function conflict(taskId, expected, actual = null) {
  const error = new Error(`Task ${taskId} revision conflict: expected ${expected}${actual === null ? '' : `, actual ${actual}`}`)
  error.code = 'TASK_REVISION_CONFLICT'
  error.taskId = taskId
  error.expectedRevision = expected
  error.actualRevision = actual
  return error
}

export class MemoryTaskStore {
  constructor() { this.tasks = new Map(); this.leases = new Map() }
  async save(task) {
    const current = this.tasks.get(task.id)
    const expected = Number(task.revision || 0)
    if (current) {
      const actual = Number(current.revision || 0)
      if (expected !== actual) throw conflict(task.id, expected, actual)
      task.revision = actual + 1
    } else {
      if (expected !== 0) throw conflict(task.id, expected, null)
      task.revision = 1
    }
    this.tasks.set(task.id, clone(task))
    return clone(task)
  }
  async load(taskId) { const task = this.tasks.get(taskId); return task ? clone(task) : null }
  async list() { return [...this.tasks.values()].map(clone) }
  async claim(taskId, { owner, leaseSeconds = 120 } = {}) {
    const task = this.tasks.get(taskId)
    if (!task || TERMINAL_TASK_STATUSES.has(task.status)) return null
    const current = this.leases.get(taskId)
    const now = Date.now()
    if (current && current.expiresAt > now && current.owner !== owner) return null
    const token = globalThis.crypto?.randomUUID?.() || `${owner || 'runner'}-${now}`
    const lease = { token, owner, expiresAt: now + Math.max(10, Number(leaseSeconds || 120)) * 1000 }
    this.leases.set(taskId, lease)
    return clone(lease)
  }
  async renew(taskId, token, { leaseSeconds = 120 } = {}) {
    const current = this.leases.get(taskId)
    if (!current || current.token !== token || current.expiresAt <= Date.now()) return null
    current.expiresAt = Date.now() + Math.max(10, Number(leaseSeconds || 120)) * 1000
    return clone(current)
  }
  async release(taskId, token) {
    const current = this.leases.get(taskId)
    if (!current || current.token !== token) return false
    this.leases.delete(taskId)
    return true
  }
}

export class SupabaseTaskStore {
  constructor({ supabase }) {
    if (!supabase) throw new TypeError('supabase client is required')
    this.supabase = supabase
    this.leaseTokens = new Map()
  }
  async save(task) {
    const expected = Number(task.revision || 0)
    const nextRevision = expected + 1
    const state = clone({ ...task, revision: nextRevision })
    const row = {
      id: task.id, hotel_id: task.metadata?.hotelId || null, objective: task.objective,
      status: task.status, plan: task.plan, state, checkpoint: task.checkpoint || null,
      revision: nextRevision, completed_at: task.completedAt || null, updated_at: new Date().toISOString(),
    }

    let data
    let error
    if (expected === 0) {
      const response = await this.supabase.from('randai_tasks').insert(row).select('revision').single()
      data = response.data; error = response.error
    } else {
      let query = this.supabase.from('randai_tasks').update(row).eq('id', task.id).eq('revision', expected)
      const leaseToken = this.leaseTokens.get(task.id)
      if (leaseToken) query = query.eq('lease_token', leaseToken)
      const response = await query.select('revision').maybeSingle()
      data = response.data; error = response.error
    }
    if (error) throw error
    if (!data) throw conflict(task.id, expected, null)
    task.revision = nextRevision
    return clone(task)
  }
  async load(taskId) {
    const { data, error } = await this.supabase.from('randai_tasks').select('state,revision').eq('id', taskId).maybeSingle()
    if (error) throw error
    if (!data?.state) return null
    return clone({ ...data.state, revision: Number(data.revision || 0) })
  }
  async claim(taskId, { owner, leaseSeconds = 120 } = {}) {
    const { data, error } = await this.supabase.rpc('randai_claim_task', {
      p_task_id: taskId,
      p_lease_owner: owner,
      p_lease_seconds: Math.max(10, Number(leaseSeconds || 120)),
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.lease_token) return null
    this.leaseTokens.set(taskId, row.lease_token)
    return { token: row.lease_token, owner, expiresAt: new Date(row.lease_expires_at).getTime(), revision: Number(row.revision || 0) }
  }
  async renew(taskId, token, { leaseSeconds = 120 } = {}) {
    const { data, error } = await this.supabase.rpc('randai_renew_task_lease', {
      p_task_id: taskId,
      p_lease_token: token,
      p_lease_seconds: Math.max(10, Number(leaseSeconds || 120)),
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.lease_token) { this.leaseTokens.delete(taskId); return null }
    this.leaseTokens.set(taskId, row.lease_token)
    return { token: row.lease_token, expiresAt: new Date(row.lease_expires_at).getTime() }
  }
  async release(taskId, token) {
    const { data, error } = await this.supabase.rpc('randai_release_task_lease', {
      p_task_id: taskId,
      p_lease_token: token,
    })
    this.leaseTokens.delete(taskId)
    if (error) throw error
    return Boolean(data)
  }
}
