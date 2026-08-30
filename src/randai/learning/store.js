const clone = (value) => structuredClone(value)

export class LearningStore {
  constructor() { this.items = new Map() }
  async save(candidate) { this.items.set(candidate.id, clone(candidate)); return clone(candidate) }
  async get(id) { const item = this.items.get(id); return item ? clone(item) : null }
  async findByFingerprint(fingerprint) { return [...this.items.values()].find((item) => item.fingerprint === fingerprint) ? clone([...this.items.values()].find((item) => item.fingerprint === fingerprint)) : null }
  async list(filters = {}) {
    return [...this.items.values()].filter((item) => !filters.status || item.status === filters.status).map(clone)
  }
}

export class SupabaseLearningStore {
  constructor({ supabase } = {}) {
    if (!supabase?.from) throw new TypeError('SupabaseLearningStore requires a Supabase client')
    this.supabase = supabase
  }
  async save(candidate) {
    const payload = { id: candidate.id, fingerprint: candidate.fingerprint, problem_class: candidate.problemClass, status: candidate.status, evidence_count: candidate.evidence.length, candidate: clone(candidate), updated_at: candidate.updatedAt }
    const { error } = await this.supabase.from('randai_learning_candidates').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(candidate)
  }
  async get(id) {
    const { data, error } = await this.supabase.from('randai_learning_candidates').select('candidate').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.candidate ? clone(data.candidate) : null
  }
  async findByFingerprint(fingerprint) {
    const { data, error } = await this.supabase.from('randai_learning_candidates').select('candidate').eq('fingerprint', fingerprint).maybeSingle()
    if (error) throw error
    return data?.candidate ? clone(data.candidate) : null
  }
  async list(filters = {}) {
    let query = this.supabase.from('randai_learning_candidates').select('candidate')
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => clone(row.candidate))
  }
}
