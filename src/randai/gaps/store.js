import { validateGap } from './contracts.js'

const clone = (value) => structuredClone(value)

export class KnowledgeGapStore {
  #items = new Map()
  async save(gap) { validateGap(gap); this.#items.set(gap.id, clone(gap)); return clone(gap) }
  async get(id) { const item = this.#items.get(id); return item ? clone(item) : null }
  async list({ hotelId, scope, status } = {}) {
    return [...this.#items.values()]
      .filter((item) => !hotelId || item.hotelId === hotelId)
      .filter((item) => !scope || item.scope === scope)
      .filter((item) => !status || item.status === status)
      .map(clone)
  }
}

export class SupabaseKnowledgeGapStore {
  constructor({ supabase }) {
    if (!supabase) throw new TypeError('supabase is required')
    this.supabase = supabase
  }

  async save(gap) {
    validateGap(gap)
    const row = {
      id: gap.id,
      scope: gap.scope,
      status: gap.status,
      priority: gap.priority,
      hotel_id: gap.hotelId || null,
      project_id: gap.projectId || null,
      task_id: gap.taskId || null,
      question: gap.question,
      context: gap.context || null,
      entity_type: gap.entityType || null,
      entity_id: gap.entityId || null,
      proposed_answer: gap.proposedAnswer || null,
      source_kind: gap.source?.kind || null,
      source_id: gap.source?.id || null,
      resolution_source_kind: gap.resolutionSource?.kind || null,
      resolution_source_id: gap.resolutionSource?.id || null,
      metadata: gap.metadata || {},
      created_at: gap.createdAt,
      updated_at: gap.updatedAt,
      resolved_at: gap.resolvedAt || null,
    }
    const { error } = await this.supabase.from('randai_knowledge_gaps').upsert(row)
    if (error) throw error
    return gap
  }

  async list({ hotelId, scope, status } = {}) {
    let query = this.supabase.from('randai_knowledge_gaps').select('*')
    if (hotelId) query = query.eq('hotel_id', hotelId)
    if (scope) query = query.eq('scope', scope)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row) => ({
      id: row.id, scope: row.scope, status: row.status, priority: row.priority,
      hotelId: row.hotel_id, projectId: row.project_id, taskId: row.task_id,
      question: row.question, context: row.context, entityType: row.entity_type, entityId: row.entity_id,
      proposedAnswer: row.proposed_answer,
      source: row.source_kind ? { kind: row.source_kind, id: row.source_id } : null,
      resolutionSource: row.resolution_source_kind ? { kind: row.resolution_source_kind, id: row.resolution_source_id } : null,
      metadata: row.metadata || {}, createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at,
    }))
  }
}
