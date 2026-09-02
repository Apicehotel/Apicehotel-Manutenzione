import { validateMemory } from './contracts.js'

const clone = (value) => JSON.parse(JSON.stringify(value))

export class MemoryStore {
  #items = new Map()
  async save(memory) { validateMemory(memory); this.#items.set(memory.id, clone(memory)); return clone(memory) }
  async get(id) { return this.#items.has(id) ? clone(this.#items.get(id)) : null }
  async list({ scope, hotelId, projectId, taskId } = {}) {
    return [...this.#items.values()]
      .filter((memory) => !scope || memory.scope === scope)
      .filter((memory) => !hotelId || memory.hotelId === hotelId)
      .filter((memory) => !projectId || memory.projectId === projectId)
      .filter((memory) => !taskId || memory.taskId === taskId)
      .map(clone)
  }
  async remove(id) { return this.#items.delete(id) }
}

export class SupabaseMemoryStore {
  constructor({ supabase }) {
    if (!supabase) throw new TypeError('supabase is required')
    this.supabase = supabase
  }

  async save(memory) {
    validateMemory(memory)
    const row = {
      id: memory.id,
      type: memory.type,
      scope: memory.scope,
      trust: memory.trust,
      hotel_id: memory.hotelId || null,
      project_id: memory.projectId || null,
      task_id: memory.taskId || null,
      content: memory.content,
      summary: memory.summary || null,
      source_kind: memory.source.kind,
      source_id: memory.source.id,
      source_uri: memory.source.uri || null,
      importance: memory.importance,
      confidence: memory.confidence,
      entities: memory.entities || [],
      tags: memory.tags || [],
      expires_at: memory.expiresAt || null,
      metadata: memory.metadata || {},
      created_at: memory.createdAt,
      updated_at: memory.updatedAt,
    }
    const { error } = await this.supabase.from('randai_memory_items').upsert(row)
    if (error) throw error
    return memory
  }

  async list({ scope, hotelId, projectId, taskId } = {}) {
    let query = this.supabase.from('randai_memory_items').select('*')
    if (scope) query = query.eq('scope', scope)
    if (hotelId) query = query.eq('hotel_id', hotelId)
    if (projectId) query = query.eq('project_id', projectId)
    if (taskId) query = query.eq('task_id', taskId)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row) => ({
      id: row.id, type: row.type, scope: row.scope, trust: row.trust,
      hotelId: row.hotel_id, projectId: row.project_id, taskId: row.task_id,
      content: row.content, summary: row.summary,
      source: { kind: row.source_kind, id: row.source_id, uri: row.source_uri },
      importance: Number(row.importance), confidence: Number(row.confidence),
      entities: row.entities || [], tags: row.tags || [], expiresAt: row.expires_at,
      metadata: row.metadata || {}, createdAt: row.created_at, updatedAt: row.updated_at,
    }))
  }
}
