const clone = (value) => structuredClone(value)

export class ProjectGraphStore {
  constructor() { this.items = new Map() }
  async save(graph) { this.items.set(graph.projectId, clone(graph)); return clone(graph) }
  async load(projectId) { const item = this.items.get(projectId); return item ? clone(item) : null }
}

export class SupabaseProjectGraphStore {
  constructor({ supabase } = {}) {
    if (!supabase?.from) throw new TypeError('SupabaseProjectGraphStore requires a Supabase client')
    this.supabase = supabase
  }
  async save(graph) {
    const payload = { project_id: graph.projectId, graph: clone(graph), updated_at: new Date().toISOString() }
    const { error } = await this.supabase.from('randai_project_graphs').upsert(payload, { onConflict: 'project_id' })
    if (error) throw error
    return clone(graph)
  }
  async load(projectId) {
    const { data, error } = await this.supabase.from('randai_project_graphs').select('graph').eq('project_id', projectId).maybeSingle()
    if (error) throw error
    return data?.graph ? clone(data.graph) : null
  }
}
