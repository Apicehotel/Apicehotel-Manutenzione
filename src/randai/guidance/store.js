const clone = (value) => structuredClone(value)

export class GuidanceSessionStore {
  #items = new Map()
  async save(session) { this.#items.set(session.id, clone(session)); return clone(session) }
  async get(id) { const item = this.#items.get(id); return item ? clone(item) : null }
  async list({ hotelId, status } = {}) { return [...this.#items.values()].filter((x) => (!hotelId || x.hotelId === hotelId) && (!status || x.status === status)).map(clone) }
}

export class SupabaseGuidanceSessionStore {
  constructor({ supabase } = {}) { if (!supabase) throw new TypeError('SupabaseGuidanceSessionStore requires supabase client'); this.supabase = supabase }
  async save(session) {
    const row = { id: session.id, hotel_id: session.hotelId, procedure_id: session.procedureId, procedure_version: session.procedureVersion, actor_role: session.actorRole, status: session.status, current_step_id: session.currentStepId, state: clone(session), updated_at: session.updatedAt, completed_at: session.completedAt }
    const { error } = await this.supabase.from('randai_guidance_sessions').upsert(row)
    if (error) throw error
    return clone(session)
  }
  async get(id) { const { data, error } = await this.supabase.from('randai_guidance_sessions').select('state').eq('id', id).single(); if (error) throw error; return data?.state ? clone(data.state) : null }
  async list({ hotelId, status } = {}) { let q = this.supabase.from('randai_guidance_sessions').select('state'); if (hotelId) q = q.eq('hotel_id', hotelId); if (status) q = q.eq('status', status); const { data, error } = await q; if (error) throw error; return (data || []).map((x) => clone(x.state)) }
}
