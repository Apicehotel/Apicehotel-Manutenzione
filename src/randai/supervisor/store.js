const clone = (value) => structuredClone(value)

const matchesHotel = (run, hotelId = null) => {
  const requested = String(hotelId || '').trim() || null
  const actual = String(run?.hotelId || '').trim() || null
  return requested == null ? actual == null : actual === requested
}

export class SupervisorStore {
  constructor() { this.items = new Map() }
  async save(run) { this.items.set(run.id, clone(run)); return clone(run) }
  async get(id, { hotelId = null } = {}) { const item = this.items.get(id); return item && matchesHotel(item, hotelId) ? clone(item) : null }
  async list(filters = {}) {
    return [...this.items.values()]
      .filter((item) => !filters.projectId || item.projectId === filters.projectId)
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => filters.hotelId == null || matchesHotel(item, filters.hotelId))
      .map(clone)
  }
}

export class SupabaseSupervisorStore {
  constructor({ supabase } = {}) { if (!supabase?.from) throw new TypeError('SupabaseSupervisorStore requires Supabase client'); this.supabase = supabase }
  async save(run) {
    const payload = { id: run.id, project_id: run.projectId, task_id: run.taskId, status: run.status, mode: run.mode, result: clone(run), updated_at: run.updatedAt, completed_at: run.completedAt }
    const { error } = await this.supabase.from('randai_supervisor_runs').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(run)
  }
  async get(id, { hotelId = null } = {}) {
    const { data, error } = await this.supabase.from('randai_supervisor_runs').select('result').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.result && matchesHotel(data.result, hotelId) ? clone(data.result) : null
  }
  async list(filters = {}) {
    let query = this.supabase.from('randai_supervisor_runs').select('result')
    if (filters.projectId) query = query.eq('project_id', filters.projectId)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => clone(row.result)).filter((run) => filters.hotelId == null || matchesHotel(run, filters.hotelId))
  }
}
