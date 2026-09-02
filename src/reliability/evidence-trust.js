const text = (v) => String(v ?? '').trim()
const clamp = (n) => Math.max(0, Math.min(1, n))

export const EvidenceTier = Object.freeze({ APPROVED: 'approved', VERIFIED: 'verified', OBSERVED: 'observed', SUGGESTED: 'suggested', UNKNOWN: 'unknown' })
const BASE = Object.freeze({ approved: 1, verified: 0.9, observed: 0.72, suggested: 0.45, unknown: 0.2 })

export function evaluateEvidenceTrust({ evidence = [], hotelId, now = Date.now(), maxAgeMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  const scope = text(hotelId)
  if (!scope) throw new TypeError('hotelId is required')
  if (!Array.isArray(evidence) || evidence.length === 0) throw new TypeError('evidence is required')
  const ids = new Set()
  const sources = new Set()
  const scored = evidence.map((item) => {
    const id = text(item?.id)
    if (!id || ids.has(id)) throw new TypeError('evidence ids must be unique')
    ids.add(id)
    if (text(item.hotelId) !== scope) throw new Error('EVIDENCE_HOTEL_MISMATCH')
    const tier = text(item.tier).toLowerCase()
    if (!(tier in BASE)) throw new TypeError(`invalid evidence tier: ${tier}`)
    const at = Date.parse(item.at)
    if (!Number.isFinite(at)) throw new TypeError('evidence.at must be a valid date')
    const age = Math.max(0, now - at)
    const freshness = maxAgeMs > 0 ? clamp(1 - (age / maxAgeMs)) : 0
    const source = `${text(item.source?.kind)}:${text(item.source?.id)}`
    if (source === ':') throw new TypeError('evidence source is required')
    sources.add(source)
    const score = clamp((BASE[tier] * 0.8) + (freshness * 0.2))
    return Object.freeze({ id, tier, source, score, freshness })
  })
  const average = scored.reduce((sum, item) => sum + item.score, 0) / scored.length
  const corroboration = clamp((sources.size - 1) / 2)
  const trust = clamp((average * 0.85) + (corroboration * 0.15))
  return Object.freeze({ hotelId: scope, trust, corroboration, sources: sources.size, evidence: Object.freeze(scored) })
}
