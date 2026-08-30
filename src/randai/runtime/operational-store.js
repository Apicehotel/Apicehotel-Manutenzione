import { MemoryTaskStore, SupabaseTaskStore } from './store.js'

const TERMINAL_TASK_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])
const clone = (value) => structuredClone(value)

function sourceMatches(task, { hotelId, sourceType, sourceId }) {
  return !TERMINAL_TASK_STATUSES.has(task.status)
    && task.metadata?.hotelId === hotelId
    && task.metadata?.sourceType === sourceType
    && String(task.metadata?.sourceId) === String(sourceId)
}

export class OperationalMemoryTaskStore extends MemoryTaskStore {
  async findActiveBySource({ hotelId, sourceType, sourceId } = {}) {
    if (!hotelId || !sourceType || sourceId === null || sourceId === undefined) return null
    const tasks = await this.list()
    return tasks.find((task) => sourceMatches(task, { hotelId, sourceType, sourceId })) || null
  }
}

export class OperationalSupabaseTaskStore extends SupabaseTaskStore {
  constructor({ supabase }) {
    super({ supabase })
    this.operationalSupabase = supabase
  }

  async save(task) {
    const saved = await super.save(task)
    const sourceType = task.metadata?.sourceType || null
    const sourceId = task.metadata?.sourceId === null || task.metadata?.sourceId === undefined
      ? null
      : String(task.metadata.sourceId)
    if (sourceType && sourceId) {
      const { error } = await this.operationalSupabase
        .from('randai_tasks')
        .update({ source_type: sourceType, source_id: sourceId })
        .eq('id', task.id)
      if (error) throw error
    }
    return saved
  }

  async findActiveBySource({ hotelId, sourceType, sourceId } = {}) {
    if (!hotelId || !sourceType || sourceId === null || sourceId === undefined) return null
    const { data, error } = await this.operationalSupabase
      .from('randai_tasks')
      .select('state,revision')
      .eq('hotel_id', hotelId)
      .eq('source_type', sourceType)
      .eq('source_id', String(sourceId))
      .not('status', 'in', '(SUCCEEDED,FAILED,CANCELLED)')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data?.state) return null
    return clone({ ...data.state, revision: Number(data.revision || 0) })
  }
}
