import {
  RAND_ARCHITECTURE_CURRENT_EVIDENCE,
  RandArchitectureDecision,
  listRandArchitecturePatterns,
} from './catalog.js'

function clean(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeSignals(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean))]
}

function signalScore(pattern, signals) {
  if (!signals.length) return 0
  let score = 0
  for (const signal of signals) {
    if (pattern.id.toLowerCase().includes(signal)) score += 3
    if (pattern.category.toLowerCase().includes(signal)) score += 2
    for (const useCase of pattern.useWhen) {
      const normalized = useCase.toLowerCase()
      if (normalized.includes(signal) || signal.includes(normalized)) score += 2
    }
    if (pattern.summary.toLowerCase().includes(signal)) score += 1
  }
  return score
}

function decisionForEvidence(evidence) {
  const status = String(evidence?.status || '').toUpperCase()
  if (status === 'IMPLEMENTED') return RandArchitectureDecision.KEEP
  if (status.startsWith('EVALUATE')) return RandArchitectureDecision.EVALUATE
  return RandArchitectureDecision.EVALUATE
}

export function adviseRandArchitecture({
  domain = '',
  requirements = [],
  symptoms = [],
  limit = 6,
} = {}) {
  const signals = normalizeSignals([domain, ...requirements, ...symptoms])
  const patterns = listRandArchitecturePatterns()
    .map((pattern) => {
      const evidence = RAND_ARCHITECTURE_CURRENT_EVIDENCE[pattern.id] || null
      return {
        pattern,
        evidence,
        score: signalScore(pattern, signals),
        decision: decisionForEvidence(evidence),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.pattern.id.localeCompare(b.pattern.id))
    .slice(0, Math.max(1, Math.min(12, Number(limit) || 6)))

  return Object.freeze({
    domain: String(domain || '').trim() || null,
    signals: Object.freeze(signals),
    recommendations: Object.freeze(patterns.map((item) => Object.freeze({
      id: item.pattern.id,
      category: item.pattern.category,
      summary: item.pattern.summary,
      decision: item.decision,
      currentStatus: item.evidence?.status || 'CHECK_REQUIRED',
      evidence: Object.freeze([...(item.evidence?.evidence || [])]),
      note: item.evidence?.note || 'Verify current implementation before adding a new architectural component.',
      avoidClaims: Object.freeze([...item.pattern.avoidClaims]),
      score: item.score,
    }))),
    policy: Object.freeze({
      evidenceBeforeChange: true,
      noSecondCanonicalOwner: true,
      noRuntimeImportFromReferenceSource: true,
      noAutomaticInfrastructureProvisioning: true,
      humanReviewRequiredForArchitectureChanges: true,
    }),
  })
}

export function architectureGapSummary(advice) {
  const recommendations = Array.isArray(advice?.recommendations) ? advice.recommendations : []
  const keep = recommendations.filter((item) => item.decision === RandArchitectureDecision.KEEP)
  const evaluate = recommendations.filter((item) => item.decision === RandArchitectureDecision.EVALUATE)
  return Object.freeze({
    total: recommendations.length,
    keep: keep.length,
    evaluate: evaluate.length,
    add: 0,
    rejected: 0,
    unresolved: evaluate.length,
  })
}
