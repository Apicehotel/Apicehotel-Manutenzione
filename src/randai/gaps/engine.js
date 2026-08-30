import { GapPriority, GapScope, GapStatus } from './contracts.js'
import { KnowledgeGapStore } from './store.js'

const clone = (value) => structuredClone(value)
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
const makeId = () => `GAP-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

export class KnowledgeGapEngine {
  constructor({ store = new KnowledgeGapStore() } = {}) { this.store = store }

  async open(input = {}) {
    const scope = input.scope || GapScope.MAINTENANCE
    const status = GapStatus.OPEN
    const question = String(input.question || '').trim()
    if (!question) throw new TypeError('Gap question is required')
    const existing = await this.store.list({ hotelId: input.hotelId, scope, status })
    const duplicate = existing.find((item) => normalize(item.question) === normalize(question) && normalize(item.entityId) === normalize(input.entityId))
    if (duplicate) return { gap: duplicate, created: false }
    const now = new Date().toISOString()
    const gap = {
      id: input.id || makeId(),
      scope,
      status,
      priority: input.priority || GapPriority.NORMAL,
      hotelId: input.hotelId || null,
      projectId: input.projectId || null,
      taskId: input.taskId || null,
      question,
      context: input.context || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      proposedAnswer: null,
      source: input.source || null,
      resolutionSource: null,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    }
    await this.store.save(gap)
    return { gap: clone(gap), created: true }
  }

  async captureUnknown(result, input = {}) {
    if (result?.found !== false && result?.trust !== 'unknown') return { captured: false, reason: 'KNOWLEDGE_AVAILABLE' }
    const opened = await this.open({
      scope: input.scope || GapScope.MAINTENANCE,
      hotelId: input.hotelId || result?.hotelId || null,
      projectId: input.projectId,
      taskId: input.taskId,
      question: input.question || result?.query || 'Informazione mancante',
      context: input.context || result?.message || null,
      priority: input.priority || GapPriority.NORMAL,
      entityType: input.entityType,
      entityId: input.entityId,
      source: input.source || { kind: 'knowledge_lookup', id: input.lookupId || 'unknown' },
      metadata: { ...(input.metadata || {}), capturedFromUnknown: true },
    })
    return { captured: true, ...opened }
  }

  async propose(id, { answer, source } = {}) {
    if (!String(answer || '').trim()) throw new TypeError('Proposed answer is required')
    const gap = await this.#require(id)
    if (gap.status === GapStatus.RESOLVED || gap.status === GapStatus.DISMISSED) throw new Error(`Gap is closed: ${id}`)
    gap.status = GapStatus.PROPOSED
    gap.proposedAnswer = String(answer).trim()
    gap.source = source || gap.source
    gap.updatedAt = new Date().toISOString()
    await this.store.save(gap)
    return clone(gap)
  }

  async resolve(id, { source, approved = false } = {}) {
    if (!approved) throw new Error('Knowledge gap resolution requires explicit approval')
    if (!source?.kind || !source?.id) throw new TypeError('Verified resolution source is required')
    const gap = await this.#require(id)
    if (gap.status !== GapStatus.PROPOSED && gap.status !== GapStatus.OPEN) throw new Error(`Gap cannot be resolved from status: ${gap.status}`)
    const now = new Date().toISOString()
    gap.status = GapStatus.RESOLVED
    gap.resolutionSource = clone(source)
    gap.resolvedAt = now
    gap.updatedAt = now
    await this.store.save(gap)
    return clone(gap)
  }

  async dismiss(id, { reason = null } = {}) {
    const gap = await this.#require(id)
    gap.status = GapStatus.DISMISSED
    gap.metadata = { ...(gap.metadata || {}), dismissReason: reason }
    gap.updatedAt = new Date().toISOString()
    await this.store.save(gap)
    return clone(gap)
  }

  async list(filters = {}) { return this.store.list(filters) }

  async #require(id) {
    if (typeof this.store.get === 'function') {
      const item = await this.store.get(id)
      if (item) return item
    }
    const all = await this.store.list()
    const item = all.find((gap) => gap.id === id)
    if (!item) throw new Error(`Unknown knowledge gap: ${id}`)
    return item
  }
}
