const clone = (value) => structuredClone(value)

function conflict(taskId, expected, actual = null) {
  const error = new Error(`Task ${taskId} revision conflict: expected ${expected}${actual === null ? '' : `, actual ${actual}`}`)
  error.code = 'TASK_REVISION_CONFLICT'
  error.taskId = taskId
  error.expectedRevision = expected
  error.actualRevision = actual
  return error
}

export class MemoryTaskStore {
  constructor() { this.tasks = new Map() }
  async save(task) {
    const current = this.tasks.get(task.id)
    const expected = Number(task.revision || 0)
    if (current) {
      const actual = Number(current.revision || 0)
      if (expected !== actual) throw conflict(task.id, expected, actual)
      task.revision = actual + 1
    } else {
      if (expected !== 0) throw conflict(task.id, expected, null)
      task.revision = 1
    }
    this.tasks.set(task.id, clone(task))
    return clone(task)
  }
  async load(taskId) { const task = this.tasks.get(taskId); return task ? clone(task) : null }
  async list() { return [...this.tasks.values()].map(clone) }
}

export class SupabaseTaskStore {
  constructor({ supabase }) {
    if (!supabase) throw new TypeError('supabase client is required')
    this.supabase = supabase
  }
  async save(task) {
    const expected = Number(task.revision || 0)
    const nextRevision = expected + 1
    const state = clone({ ...task, revision: nextRevision })
    const row = {
      id: task.id, hotel_id: task.metadata?.hotelId || null, objective: task.objective,
      status: task.status, plan: task.plan, state, checkpoint: task.checkpoint || null,
      revision: nextRevision, completed_at: task.completedAt || null, updated_at: new Date().toISOString(),
    }

    let data
    let error
    if (expected === 0) {
      const response = await this.supabase.from('randai_tasks').insert(row).select('revision').single()
      data = response.data; error = response.error
    } else {
      const response = await this.supabase.from('randai_tasks').update(row).eq('id', task.id).eq('revision', expected).select('revision').maybeSingle()
      data = response.data; error = response.error
    }
    if (error) throw error
    if (!data) throw conflict(task.id, expected, null)
    task.revision = nextRevision
    return clone(task)
  }
  async load(taskId) {
    const { data, error } = await this.supabase.from('randai_tasks').select('state,revision').eq('id', taskId).maybeSingle()
    if (error) throw error
    if (!data?.state) return null
    return clone({ ...data.state, revision: Number(data.revision || 0) })
  }
}
