export const RANDCORE_HEALTH_CONTRACT_VERSION = 2

export const RANDCORE_HEALTH_DOMAINS = Object.freeze([
  'database',
  'security',
  'workers',
  'deploy',
  'backup_restore',
  'integrations',
  'dependencies',
])

export const EvidenceState = Object.freeze({ VERIFIED:'VERIFIED', UNKNOWN:'UNKNOWN', STALE:'STALE' })
export const EvidenceFreshness = Object.freeze({ FRESH:'FRESH', STALE:'STALE', UNKNOWN:'UNKNOWN' })

const HEALTH_STATUSES = Object.freeze(['HEALTHY', 'DEGRADED', 'CRITICAL', 'UNKNOWN'])
const clamp = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0))
const asDateMs = (value) => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function normalizeDomainEvidence(domain, input = {}, {
  now = new Date().toISOString(),
  defaultMaxAgeMs = 32 * 24 * 60 * 60 * 1000,
} = {}) {
  if (!RANDCORE_HEALTH_DOMAINS.includes(domain)) throw new Error(`randcore-health-unknown-domain:${domain}`)
  const status = HEALTH_STATUSES.includes(String(input.status || '').toUpperCase()) ? String(input.status).toUpperCase() : 'UNKNOWN'
  const checkedAt = input.checkedAt || input.checked_at || null
  const checkedMs = asDateMs(checkedAt)
  const nowMs = asDateMs(now) ?? Date.now()
  const maxAgeMs = Number.isFinite(Number(input.maxAgeMs)) && Number(input.maxAgeMs) > 0 ? Number(input.maxAgeMs) : defaultMaxAgeMs
  const hasEvidence = Boolean(input.evidence || input.source || input.measured === true || input.state === 'MEASURED' || input.state === EvidenceState.VERIFIED)
  const freshness = !checkedMs ? EvidenceFreshness.UNKNOWN : nowMs - checkedMs > maxAgeMs ? EvidenceFreshness.STALE : EvidenceFreshness.FRESH
  const state = !hasEvidence ? EvidenceState.UNKNOWN : freshness === EvidenceFreshness.STALE ? EvidenceState.STALE : EvidenceState.VERIFIED
  const verified = state === EvidenceState.VERIFIED
  const score = verified && status !== 'UNKNOWN' && input.score != null ? clamp(input.score) : null
  const confidence = verified ? clamp(input.confidence ?? 100) : 0
  return Object.freeze({
    domain, state, status:verified ? status : 'UNKNOWN', score, checkedAt, freshness, confidence,
    source:input.source ? String(input.source) : null,
    evidence:input.evidence ?? null,
    details:input.details && typeof input.details === 'object' ? input.details : {},
  })
}

export function buildHealthEvidenceSnapshot({
  domains = {},
  generatedAt = new Date().toISOString(),
  evaluatedAt = generatedAt,
} = {}) {
  const normalized = Object.fromEntries(RANDCORE_HEALTH_DOMAINS.map((domain) => [domain, normalizeDomainEvidence(domain, domains[domain] || {}, { now:evaluatedAt })]))
  const values = Object.values(normalized)
  const verified = values.filter((item) => item.state === EvidenceState.VERIFIED)
  const stale = values.filter((item) => item.state === EvidenceState.STALE)
  const unknown = values.filter((item) => item.state === EvidenceState.UNKNOWN)
  const scored = verified.filter((item) => item.score != null)
  const score = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length) : 0
  const confidence = Math.round(values.reduce((sum, item) => sum + item.confidence, 0) / RANDCORE_HEALTH_DOMAINS.length)
  const status = values.some((item) => item.status === 'CRITICAL') ? 'CRITICAL'
    : values.some((item) => item.status === 'DEGRADED') ? 'DEGRADED'
      : verified.length === 0 ? 'UNKNOWN'
        : stale.length > 0 || unknown.length > 0 ? 'DEGRADED'
          : 'HEALTHY'
  return Object.freeze({
    version:RANDCORE_HEALTH_CONTRACT_VERSION, generated_at:generatedAt, evaluated_at:evaluatedAt, status, score, confidence,
    coverage:Object.freeze({
      evaluated_domains:RANDCORE_HEALTH_DOMAINS.length,
      verified_domains:verified.length,
      measured_domains:verified.length,
      stale_domains:stale.length,
      unknown_domains:unknown.length,
      total_domains:RANDCORE_HEALTH_DOMAINS.length,
      verified_percent:Math.round((verified.length / RANDCORE_HEALTH_DOMAINS.length) * 100),
    }),
    domains:Object.freeze(normalized),
  })
}

export function fromLegacyHealthSnapshot(snapshot = {}, { generatedAt, evaluatedAt } = {}) {
  const legacyDomains = snapshot?.domains && typeof snapshot.domains === 'object' ? snapshot.domains : {}
  const checkedAt = generatedAt || snapshot.generated_at || snapshot.checked_at || null
  const domains = Object.fromEntries(RANDCORE_HEALTH_DOMAINS.map((domain) => {
    const legacy = legacyDomains[domain] || {}
    const measured = legacy.state === 'MEASURED'
    return [domain, {
      status:measured ? (legacy.status || 'HEALTHY') : 'UNKNOWN', score:measured ? (legacy.score ?? 100) : null,
      checkedAt:legacy.checkedAt || legacy.checked_at || checkedAt, measured,
      source:measured ? (legacy.source || 'legacy-randcore') : null,
      evidence:measured ? legacy : null, details:legacy, confidence:measured ? 100 : 0,
    }]
  }))
  const snapshotGeneratedAt = checkedAt || new Date().toISOString()
  return buildHealthEvidenceSnapshot({ domains, generatedAt:snapshotGeneratedAt, evaluatedAt:evaluatedAt || snapshotGeneratedAt })
}

export function coerceHealthEvidenceSnapshot(snapshot = {}, options = {}) {
  if (Number(snapshot?.version) < RANDCORE_HEALTH_CONTRACT_VERSION) return fromLegacyHealthSnapshot(snapshot, options)
  const generatedAt = options.generatedAt || snapshot.generated_at || new Date().toISOString()
  return buildHealthEvidenceSnapshot({ domains:snapshot.domains || {}, generatedAt, evaluatedAt:options.evaluatedAt || generatedAt })
}

export function mergeHealthEvidenceSnapshots(snapshots = [], { generatedAt = new Date().toISOString() } = {}) {
  const normalized = snapshots.filter(Boolean).map((snapshot) => coerceHealthEvidenceSnapshot(snapshot, { evaluatedAt:generatedAt }))
  const domains = Object.fromEntries(RANDCORE_HEALTH_DOMAINS.map((domain) => {
    const candidates = normalized.map((snapshot) => snapshot.domains[domain]).filter(Boolean)
    const ranked = candidates.sort((a, b) => {
      const aRank = a.state === EvidenceState.VERIFIED ? 2 : a.state === EvidenceState.STALE ? 1 : 0
      const bRank = b.state === EvidenceState.VERIFIED ? 2 : b.state === EvidenceState.STALE ? 1 : 0
      if (aRank !== bRank) return bRank - aRank
      return (asDateMs(b.checkedAt) || 0) - (asDateMs(a.checkedAt) || 0)
    })
    return [domain, ranked[0] || {}]
  }))
  return buildHealthEvidenceSnapshot({ domains, generatedAt, evaluatedAt:generatedAt })
}
