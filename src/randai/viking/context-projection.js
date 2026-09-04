const TIERS = Object.freeze({ L0: 180, L1: 1200, L2: 4800 })

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const bounded = (value, limit) => clean(value).slice(0, limit)
const freezeEvidence = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })))

export function buildTieredAuthorizedContext({ hotelId, query, evidence = [], includeDetails = false } = {}) {
  const scope = clean(hotelId)
  if (!scope) throw new TypeError('hotelId is required for tiered context')
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array')
  const scoped = evidence.filter((item) => clean(item?.hotelId) === scope && item?.authorized === true)
  const normalized = scoped.map((item) => ({
    id: clean(item.id),
    kind: clean(item.kind || 'evidence'),
    source: clean(item.source),
    summary: bounded(item.summary || item.content, TIERS.L0),
    overview: bounded(item.overview || item.content || item.summary, TIERS.L1),
    details: includeDetails ? bounded(item.details || item.content || item.overview, TIERS.L2) : null,
  })).filter((item) => item.id && item.source)
  const trace = normalized.map((item, index) => ({ order: index + 1, evidenceId: item.id, source: item.source, loadedTier: includeDetails ? 'L2' : item.overview ? 'L1' : 'L0' }))
  return Object.freeze({
    schema: 'rand.authorized-context-projection.v1',
    hotelId: scope,
    query: bounded(query, 500),
    tiers: Object.freeze({ L0: freezeEvidence(normalized.map(({ details, overview, ...item }) => item)), L1: freezeEvidence(normalized.map(({ details, ...item }) => item)), L2: includeDetails ? freezeEvidence(normalized) : Object.freeze([]) }),
    trace: freezeEvidence(trace),
    authority: 'AuthorizedContextEngine',
    persisted: false,
  })
}
