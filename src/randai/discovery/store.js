const clone = (value) => structuredClone(value)

export class DiscoveryStore {
  constructor() { this.items = new Map() }
  async save(item) { this.items.set(item.id, clone(item)); return clone(item) }
  async get(id) { const item = this.items.get(id); return item ? clone(item) : null }
  async list(filters = {}) {
    return [...this.items.values()]
      .filter((item) => !filters.projectId || item.projectId === filters.projectId)
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => !filters.kind || item.kind === filters.kind)
      .map(clone)
  }
}

export class SupabaseDiscoveryStore {
  constructor({ supabase } = {}) { if (!supabase?.from) throw new TypeError('SupabaseDiscoveryStore requires Supabase client'); this.supabase = supabase }
  async save(item) {
    const payload = { id: item.id, project_id: item.projectId, kind: item.kind, status: item.status, source_id: item.source.id, source_ref: item.source.ref, risk: item.risk, score: item.score, candidate: clone(item), updated_at: item.updatedAt }
    const { error } = await this.supabase.from('randai_discovery_candidates').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(item)
  }
  async get(id) { const { data, error } = await this.supabase.from('randai_discovery_candidates').select('candidate').eq('id', id).maybeSingle(); if (error) throw error; return data?.candidate ? clone(data.candidate) : null }
  async list(filters = {}) {
    let query = this.supabase.from('randai_discovery_candidates').select('candidate')
    if (filters.projectId) query = query.eq('project_id', filters.projectId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.kind) query = query.eq('kind', filters.kind)
    const { data, error } = await query.order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => clone(row.candidate))
  }
}
