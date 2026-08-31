const clone = (value) => structuredClone(value)

export class LearningStore {
  constructor() { this.items = new Map() }
  async save(candidate) { this.items.set(candidate.id, clone(candidate)); return clone(candidate) }
  async get(id) { const item = this.items.get(id); return item ? clone(item) : null }
  async findByFingerprint(fingerprint, hotelId = null) {
    const item = [...this.items.values()].find((entry) => entry.fingerprint === fingerprint && (hotelId == null || entry.hotelId === hotelId))
    return item ? clone(item) : null
  }
  async list(filters = {}) {
    return [...this.items.values()]
      .filter((item) => (!filters.status || item.status === filters.status) && (!filters.hotelId || item.hotelId === filters.hotelId))
      .map(clone)
  }
}

export class SupabaseLearningStore {
  constructor({ supabase } = {}) {
    if (!supabase?.from) throw new TypeError('SupabaseLearningStore requires a Supabase client')
    this.supabase = supabase
  }
  async save(candidate) {
    const hotelId = String(candidate.hotelId || '').trim()
    if (!hotelId) throw new TypeError('hotelId is required for persistent learning candidates')
    const payload = {
      id: candidate.id,
      hotel_id: hotelId,
      fingerprint: candidate.fingerprint,
      problem_class: candidate.problemClass,
      status: candidate.status,
      evidence_count: candidate.evidence.length,
      candidate: clone(candidate),
      learning_score: Math.min(1, candidate.evidence.length / 5),
      updated_at: candidate.updatedAt,
    }
    const { error } = await this.supabase.from('randai_learning_candidates').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(candidate)
  }
  async get(id) {
    const { data, error } = await this.supabase.from('randai_learning_candidates').select('candidate').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.candidate ? clone(data.candidate) : null
  }
  async findByFingerprint(fingerprint, hotelId = null) {
    if (!hotelId) return null
    const { data, error } = await this.supabase.from('randai_learning_candidates').select('candidate').eq('hotel_id', hotelId).eq('fingerprint', fingerprint).maybeSingle()
    if (error) throw error
    return data?.candidate ? clone(data.candidate) : null
  }
  async list(filters = {}) {
    let query = this.supabase.from('randai_learning_candidates').select('candidate')
    if (filters.hotelId) query = query.eq('hotel_id', filters.hotelId)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('updated_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => clone(row.candidate))
  }
}
