const clone = (value) => structuredClone(value)

export class MemoryTaskStore {
  constructor() { this.tasks = new Map() }
  async save(task) { this.tasks.set(task.id, clone(task)); return clone(task) }
  async load(taskId) { const task = this.tasks.get(taskId); return task ? clone(task) : null }
  async list() { return [...this.tasks.values()].map(clone) }
}

export class SupabaseTaskStore {
  constructor({ supabase }) {
    if (!supabase) throw new TypeError('supabase client is required')
    this.supabase = supabase
  }
  async save(task) {
    const row = {
      id: task.id, hotel_id: task.metadata?.hotelId || null, objective: task.objective,
      status: task.status, plan: task.plan, state: task, checkpoint: task.checkpoint || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await this.supabase.from('randai_tasks').upsert(row, { onConflict: 'id' })
    if (error) throw error
    return clone(task)
  }
  async load(taskId) {
    const { data, error } = await this.supabase.from('randai_tasks').select('state').eq('id', taskId).maybeSingle()
    if (error) throw error
    return data?.state ? clone(data.state) : null
  }
}
