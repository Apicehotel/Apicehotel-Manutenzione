const clone = (value) => structuredClone(value)

export class EvalStore {
  constructor() { this.items = new Map() }
  async save(run) { this.items.set(run.id, clone(run)); return clone(run) }
  async get(id) { const item = this.items.get(id); return item ? clone(item) : null }
  async list(filters = {}) {
    return [...this.items.values()]
      .filter((item) => !filters.suiteId || item.suiteId === filters.suiteId)
      .filter((item) => !filters.status || item.status === filters.status)
      .map(clone)
  }
}

export class SupabaseEvalStore {
  constructor({ supabase } = {}) {
    if (!supabase?.from) throw new TypeError('SupabaseEvalStore requires a Supabase client')
    this.supabase = supabase
  }
  async save(run) {
    const payload = { id: run.id, suite_id: run.suiteId, scenario_id: run.scenarioId, status: run.status, score: run.score, passed: run.passed, result: clone(run), updated_at: run.updatedAt, completed_at: run.completedAt }
    const { error } = await this.supabase.from('randai_eval_runs').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(run)
  }
  async get(id) {
    const { data, error } = await this.supabase.from('randai_eval_runs').select('result').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.result ? clone(data.result) : null
  }
  async list(filters = {}) {
    let query = this.supabase.from('randai_eval_runs').select('result')
    if (filters.suiteId) query = query.eq('suite_id', filters.suiteId)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => clone(row.result))
  }
}
