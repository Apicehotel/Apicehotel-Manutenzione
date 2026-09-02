import { validateAutonomyPolicy } from './contracts.js'

const clone = (value) => structuredClone(value)

export class AutonomyPolicyStore {
  #policies = new Map()
  async save(policy) { validateAutonomyPolicy(policy); this.#policies.set(policy.id, clone(policy)); return clone(policy) }
  async get(id) { const value = this.#policies.get(id); return value ? clone(value) : null }
  async list() { return [...this.#policies.values()].map(clone) }
}

export class ApprovalStore {
  #items = new Map()
  async save(item) { this.#items.set(item.id, clone(item)); return clone(item) }
  async get(id) { const value = this.#items.get(id); return value ? clone(value) : null }
  async findByIdentity(identity) { return [...this.#items.values()].map(clone).find((item) => item.identity === identity) || null }
  async list() { return [...this.#items.values()].map(clone) }
}

export class SupabaseAutonomyPolicyStore {
  constructor(client) { if (!client) throw new TypeError('Supabase client is required'); this.client = client }
  async save(policy) {
    validateAutonomyPolicy(policy)
    const row = { id: policy.id, level: policy.level, max_risk: policy.maxRisk || null, allowed_tools: policy.allowedTools || [], denied_tools: policy.deniedTools || [], metadata: policy.metadata || {}, updated_at: new Date().toISOString() }
    const { data, error } = await this.client.from('randai_autonomy_policies').upsert(row).select('*').single()
    if (error) throw error
    return this.#map(data)
  }
  async get(id) { const { data, error } = await this.client.from('randai_autonomy_policies').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data ? this.#map(data) : null }
  async list() { const { data, error } = await this.client.from('randai_autonomy_policies').select('*'); if (error) throw error; return (data || []).map((row) => this.#map(row)) }
  #map(row) { return { id: row.id, level: row.level, maxRisk: row.max_risk, allowedTools: row.allowed_tools || [], deniedTools: row.denied_tools || [], metadata: row.metadata || {}, updatedAt: row.updated_at } }
}

export class SupabaseApprovalStore {
  constructor(client) { if (!client) throw new TypeError('Supabase client is required'); this.client = client }
  async save(item) {
    const scopeContext = item.payload?.scopeContext || { hotelId: item.hotelId || null, scope: item.scope || null, scopeKey: item.scopeKey || null }
    const payload = { ...(item.payload || {}), scopeContext }
    const row = { id: item.id, identity: item.identity, tool_id: item.toolId, task_id: item.taskId || null, step_id: item.stepId || null, status: item.status, requested_at: item.requestedAt, decided_at: item.decidedAt || null, expires_at: item.expiresAt || null, decided_by: item.decidedBy || null, reason: item.reason || null, payload }
    const { data, error } = await this.client.from('randai_action_approvals').upsert(row).select('*').single(); if (error) throw error; return this.#map(data)
  }
  async get(id) { const { data, error } = await this.client.from('randai_action_approvals').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data ? this.#map(data) : null }
  async findByIdentity(identity) { const { data, error } = await this.client.from('randai_action_approvals').select('*').eq('identity', identity).order('requested_at', { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data ? this.#map(data) : null }
  async list() { const { data, error } = await this.client.from('randai_action_approvals').select('*').order('requested_at', { ascending: false }); if (error) throw error; return (data || []).map((row) => this.#map(row)) }
  #map(row) {
    const payload = row.payload || {}
    const scopeContext = payload.scopeContext || {}
    return { id: row.id, identity: row.identity, toolId: row.tool_id, taskId: row.task_id, stepId: row.step_id, hotelId: scopeContext.hotelId || null, scope: scopeContext.scope || null, scopeKey: scopeContext.scopeKey || null, status: row.status, requestedAt: row.requested_at, decidedAt: row.decided_at, expiresAt: row.expires_at, decidedBy: row.decided_by, reason: row.reason, payload }
  }
}
