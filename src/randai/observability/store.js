const clone = (value) => structuredClone(value)

export class TraceStore {
  constructor() { this.items = new Map() }
  async save(trace) { this.items.set(trace.id, clone(trace)); return clone(trace) }
  async get(id) { const item = this.items.get(id); return item ? clone(item) : null }
  async list(filters = {}) {
    return [...this.items.values()]
      .filter((item) => !filters.projectId || item.projectId === filters.projectId)
      .filter((item) => !filters.taskId || item.taskId === filters.taskId)
      .filter((item) => !filters.status || item.status === filters.status)
      .map(clone)
  }
}

export class SupabaseTraceStore {
  constructor({ supabase } = {}) {
    if (!supabase?.from) throw new TypeError('SupabaseTraceStore requires a Supabase client')
    this.supabase = supabase
  }
  async save(trace) {
    const payload = { id: trace.id, project_id: trace.projectId || null, task_id: trace.taskId || null, name: trace.name, status: trace.status, trace: clone(trace), started_at: trace.startedAt, ended_at: trace.endedAt, updated_at: new Date().toISOString() }
    const { error } = await this.supabase.from('randai_observability_traces').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(trace)
  }
  async get(id) {
    const { data, error } = await this.supabase.from('randai_observability_traces').select('trace').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.trace ? clone(data.trace) : null
  }
  async list(filters = {}) {
    let query = this.supabase.from('randai_observability_traces').select('trace')
    if (filters.projectId) query = query.eq('project_id', filters.projectId)
    if (filters.taskId) query = query.eq('task_id', filters.taskId)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row) => clone(row.trace))
  }
}
