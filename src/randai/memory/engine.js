import { MemoryScope, MemoryTrust, MemoryType, validateMemory } from './contracts.js'

const nowIso = () => new Date().toISOString()
const idOf = () => `MEM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const tokens = (text) => new Set(String(text || '').toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [])
const overlap = (a, b) => {
  const x = tokens(a), y = tokens(b)
  if (!x.size || !y.size) return 0
  let hit = 0; for (const t of x) if (y.has(t)) hit += 1
  return hit / Math.max(x.size, y.size)
}
const scoped = ({ scope, hotelId, projectId, taskId } = {}) => Boolean(hotelId || projectId || taskId || scope === MemoryScope.GLOBAL)

export class MemoryEngine {
  constructor({ store }) { if (!store) throw new TypeError('store is required'); this.store = store }

  async remember(input) {
    const memory = {
      id: input.id || idOf(),
      type: input.type || MemoryType.EPISODIC,
      scope: input.scope || MemoryScope.GLOBAL,
      trust: input.trust || MemoryTrust.DRAFT,
      content: String(input.content || '').trim(), summary: input.summary || null,
      source: input.source, hotelId: input.hotelId || null, projectId: input.projectId || null, taskId: input.taskId || null,
      importance: Math.max(0, Math.min(1, Number(input.importance ?? 0.5))),
      confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.5))),
      entities: [...new Set(input.entities || [])], tags: [...new Set(input.tags || [])],
      expiresAt: input.expiresAt || null, metadata: input.metadata || {}, createdAt: input.createdAt || nowIso(), updatedAt: nowIso(),
    }
    validateMemory(memory)
    return this.store.save(memory)
  }

  async extractFromTask(task) {
    if (!task || task.status !== 'SUCCEEDED') return []
    const source = { kind: 'task', id: task.id }
    const created = []
    created.push(await this.remember({ type: MemoryType.EPISODIC, scope: task.metadata?.hotelId ? MemoryScope.HOTEL : MemoryScope.TASK, hotelId: task.metadata?.hotelId || null, taskId: task.metadata?.hotelId ? null : task.id, trust: MemoryTrust.VERIFIED, content: `Task completed: ${task.objective}`, summary: task.objective, source, importance: 0.65, confidence: 1, tags: ['task-completed'] }))
    for (const decision of task.decisions || []) created.push(await this.remember({ type: MemoryType.PROCEDURAL, scope: task.metadata?.hotelId ? MemoryScope.HOTEL : MemoryScope.TASK, hotelId: task.metadata?.hotelId || null, taskId: task.metadata?.hotelId ? null : task.id, trust: MemoryTrust.VERIFIED, content: `Decision ${decision.type}: ${decision.reason || ''}`.trim(), source, importance: 0.75, confidence: 0.9, tags: ['decision', decision.type] }))
    return created
  }

  async recall(query, filters = {}) {
    if (!scoped(filters)) throw new TypeError('Memory recall requires an explicit hotel, project, task or global scope')
    const now = Date.now(); const items = await this.store.list(filters)
    return items.filter(m => !m.expiresAt || Date.parse(m.expiresAt) > now).filter(m => !filters.types || filters.types.includes(m.type)).filter(m => !filters.trust || filters.trust.includes(m.trust)).map(m => {
      const textScore = Math.max(overlap(query, m.content), overlap(query, m.summary || ''))
      const trustScore = m.trust === MemoryTrust.APPROVED ? 1 : m.trust === MemoryTrust.VERIFIED ? 0.85 : m.trust === MemoryTrust.SUGGESTED ? 0.35 : 0.2
      const score = textScore * 0.55 + m.importance * 0.2 + m.confidence * 0.15 + trustScore * 0.1
      return { ...m, score }
    }).filter(m => m.score > 0.08).sort((a, b) => b.score - a.score)
  }

  async deduplicate(candidate, threshold = 0.82) {
    const filters = { scope: candidate.scope, hotelId: candidate.hotelId, projectId: candidate.projectId, taskId: candidate.taskId }
    if (!scoped(filters)) throw new TypeError('Memory deduplication requires an explicit hotel, project, task or global scope')
    const items = await this.store.list(filters)
    return items.find(m => overlap(candidate.content, m.content) >= threshold) || null
  }
}
