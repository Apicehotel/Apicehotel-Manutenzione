import { memoryQuality } from '../memory/randmind.js'
import { traceRandAIOperation } from './ai-observability.js'

export const KnowledgeBackend = Object.freeze({
  RANDMIND: 'randmind',
  SUPABASE: 'supabase',
  GRAPHITI: 'graphiti',
  LIGHTRAG: 'lightrag',
})

export const KnowledgeRole = Object.freeze({
  CANONICAL_MEMORY: 'canonical_memory',
  CANONICAL_DATA: 'canonical_data',
  TEMPORAL_PROJECTION: 'temporal_projection',
  RETRIEVAL_PROJECTION: 'retrieval_projection',
})

const BACKEND_ROLE = Object.freeze({
  [KnowledgeBackend.RANDMIND]: KnowledgeRole.CANONICAL_MEMORY,
  [KnowledgeBackend.SUPABASE]: KnowledgeRole.CANONICAL_DATA,
  [KnowledgeBackend.GRAPHITI]: KnowledgeRole.TEMPORAL_PROJECTION,
  [KnowledgeBackend.LIGHTRAG]: KnowledgeRole.RETRIEVAL_PROJECTION,
})

const PROJECTION_BACKENDS = new Set([KnowledgeBackend.GRAPHITI, KnowledgeBackend.LIGHTRAG])

function clean(value) {
  return String(value || '').trim()
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))]
}

function deny(code, reason) {
  return Object.freeze({ allowed: false, code, reason })
}

export function authorizeKnowledgeQuery({ actor, hotelId, targetHotelId, grantedScopes = [] } = {}) {
  if (!actor?.id) return deny('ACTOR_REQUIRED', 'Identità del caller obbligatoria.')
  const sourceHotel = clean(hotelId)
  const destinationHotel = clean(targetHotelId || hotelId)
  if (!sourceHotel || !destinationHotel) return deny('HOTEL_SCOPE_REQUIRED', 'Scope hotel obbligatorio.')
  if (sourceHotel !== destinationHotel) return deny('CROSS_HOTEL_DENIED', 'Retrieval cross-hotel vietato.')
  if (!new Set(unique(grantedScopes)).has('knowledge:read')) return deny('SCOPE_DENIED', 'Permesso knowledge:read obbligatorio.')
  return Object.freeze({ allowed: true, code: 'ALLOW', hotelId: sourceHotel })
}

export function knowledgeBackendPolicy() {
  return Object.freeze(Object.entries(BACKEND_ROLE).map(([backend, role]) => Object.freeze({
    backend,
    role,
    authoritative: !PROJECTION_BACKENDS.has(backend),
    rebuildable: PROJECTION_BACKENDS.has(backend),
  })))
}

function validAt(hit, atMs) {
  const from = hit.validFrom ? Date.parse(hit.validFrom) : NaN
  const until = hit.validUntil ? Date.parse(hit.validUntil) : NaN
  if (Number.isFinite(from) && from > atMs) return false
  if (Number.isFinite(until) && until <= atMs) return false
  return true
}

export function normalizeKnowledgeHit(input = {}, { hotelId, at = new Date().toISOString() } = {}) {
  const backend = clean(input.backend).toLowerCase()
  if (!BACKEND_ROLE[backend]) throw new TypeError(`Unknown knowledge backend: ${backend}`)
  const content = clean(input.content)
  if (!content) throw new TypeError('Knowledge content is required')
  const hitHotel = clean(input.hotelId)
  if (!hitHotel || hitHotel !== clean(hotelId)) throw new TypeError('Knowledge hit hotel scope mismatch')

  const source = input.source || {}
  if (!clean(source.kind) || !clean(source.id)) throw new TypeError('Knowledge provenance source is required')

  const canonicalRef = input.canonicalRef || (PROJECTION_BACKENDS.has(backend) ? null : source)
  if (PROJECTION_BACKENDS.has(backend) && (!clean(canonicalRef?.kind) || !clean(canonicalRef?.id))) {
    throw new TypeError('Projection hit requires canonicalRef')
  }

  const atMs = Date.parse(at)
  const normalized = Object.freeze({
    id: clean(input.id) || `${backend}:${clean(source.kind)}:${clean(source.id)}`,
    backend,
    role: BACKEND_ROLE[backend],
    hotelId: hitHotel,
    content,
    source: Object.freeze({ kind: clean(source.kind), id: clean(source.id) }),
    canonicalRef: Object.freeze({ kind: clean(canonicalRef.kind), id: clean(canonicalRef.id) }),
    validFrom: input.validFrom || null,
    validUntil: input.validUntil || null,
    observedAt: input.observedAt || input.lastVerifiedAt || null,
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.5))),
    score: Number(input.score ?? 0),
    rebuildable: PROJECTION_BACKENDS.has(backend),
  })

  if (!Number.isFinite(atMs) || !validAt(normalized, atMs)) throw new TypeError('Knowledge hit is outside requested validity window')
  return normalized
}

function memoryToKnowledge(memory, hotelId) {
  const quality = memory.quality || memoryQuality(memory)
  if (!quality.usable) return null
  return normalizeKnowledgeHit({
    id: memory.id,
    backend: KnowledgeBackend.RANDMIND,
    hotelId: memory.hotelId || hotelId,
    content: memory.content,
    source: memory.source,
    canonicalRef: memory.source,
    validFrom: memory.validFrom,
    validUntil: memory.validUntil,
    observedAt: memory.lastVerifiedAt,
    confidence: memory.confidence,
    score: quality.score,
  }, { hotelId })
}

function dedupeHits(items = []) {
  const map = new Map()
  for (const hit of items) {
    const key = `${hit.canonicalRef.kind}:${hit.canonicalRef.id}:${hit.content.toLowerCase()}`
    const previous = map.get(key)
    if (!previous || hit.score > previous.score || (hit.score === previous.score && !hit.rebuildable && previous.rebuildable)) {
      map.set(key, hit)
    }
  }
  return [...map.values()].sort((a, b) => (b.score - a.score) || (b.confidence - a.confidence))
}

async function projectionQuery(adapter, query, context, backend) {
  if (!adapter?.query) return { hits: [], status: 'DISABLED' }
  try {
    const rows = await adapter.query(query, context)
    const hits = []
    let rejected = 0
    for (const row of Array.isArray(rows) ? rows : []) {
      try {
        hits.push(normalizeKnowledgeHit({ ...row, backend }, context))
      } catch {
        rejected += 1
      }
    }
    return { hits, status: rejected ? 'DEGRADED' : 'OK', rejected }
  } catch {
    return { hits: [], status: 'UNAVAILABLE' }
  }
}

export class RandKnowledgeGateway {
  constructor({ mind, graphAdapter = null, ragAdapter = null } = {}) {
    if (!mind?.recall) throw new TypeError('RandMind recall adapter is required')
    this.mind = mind
    this.graphAdapter = graphAdapter
    this.ragAdapter = ragAdapter
  }

  async query(query, { actor, hotelId, targetHotelId, grantedScopes = [], at = new Date().toISOString(), limit = 12 } = {}) {
    const authorization = authorizeKnowledgeQuery({ actor, hotelId, targetHotelId, grantedScopes })
    if (!authorization.allowed) return Object.freeze({ authorization, hits: [], backends: {} })
    const context = { hotelId: authorization.hotelId, at }

    return traceRandAIOperation('knowledge.query', {
      'rand.hotel_id': authorization.hotelId,
      'rand.knowledge.graph_enabled': Boolean(this.graphAdapter),
      'rand.knowledge.rag_enabled': Boolean(this.ragAdapter),
    }, async () => {
      const memories = await this.mind.recall(query, { hotelId: authorization.hotelId })
      const mindHits = memories.map((memory) => memoryToKnowledge(memory, authorization.hotelId)).filter(Boolean)
      const [graph, rag] = await Promise.all([
        projectionQuery(this.graphAdapter, query, context, KnowledgeBackend.GRAPHITI),
        projectionQuery(this.ragAdapter, query, context, KnowledgeBackend.LIGHTRAG),
      ])
      const hits = dedupeHits([...mindHits, ...graph.hits, ...rag.hits]).slice(0, Math.max(1, Math.min(50, Number(limit) || 12)))
      return Object.freeze({
        authorization,
        hits: Object.freeze(hits),
        backends: Object.freeze({
          randmind: Object.freeze({ status: 'OK', count: mindHits.length }),
          graphiti: Object.freeze({ status: graph.status, count: graph.hits.length, rejected: graph.rejected || 0 }),
          lightrag: Object.freeze({ status: rag.status, count: rag.hits.length, rejected: rag.rejected || 0 }),
        }),
      })
    })
  }
}
