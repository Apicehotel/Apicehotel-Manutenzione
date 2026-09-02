const clone = (value) => structuredClone(value)

export class GuidanceStore {
  constructor() { this.items = new Map() }
  async save(session) { this.items.set(session.id, clone(session)); return clone(session) }
  async get(id, { hotelId = null } = {}) {
    const item = this.items.get(id)
    if (!item || (hotelId && item.hotelId !== hotelId)) return null
    return clone(item)
  }
  async list(filters = {}) {
    return [...this.items.values()]
      .filter((item) => !filters.hotelId || item.hotelId === filters.hotelId)
      .filter((item) => !filters.status || item.status === filters.status)
      .map(clone)
  }
}

export class SupabaseGuidanceStore {
  constructor({ supabase } = {}) {
    if (!supabase?.from) throw new TypeError('SupabaseGuidanceStore requires a Supabase client')
    this.supabase = supabase
  }
  async save(session) {
    const payload = {
      id: session.id,
      hotel_id: session.hotelId,
      procedure_id: session.procedureId,
      status: session.status,
      current_step_id: session.currentStepId,
      actor_role: session.actorRole,
      state: clone(session),
      updated_at: session.updatedAt,
      completed_at: session.completedAt,
    }
    const { error } = await this.supabase.from('randai_guidance_sessions').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return clone(session)
  }
  async get(id, { hotelId = null } = {}) {
    let query = this.supabase.from('randai_guidance_sessions').select('state').eq('id', id)
    if (hotelId) query = query.eq('hotel_id', hotelId)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data?.state ? clone(data.state) : null
  }
  async list(filters = {}) {
    let query = this.supabase.from('randai_guidance_sessions').select('state')
    if (filters.hotelId) query = query.eq('hotel_id', filters.hotelId)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row) => clone(row.state))
  }
}
