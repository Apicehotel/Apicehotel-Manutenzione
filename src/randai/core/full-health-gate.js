import { EvidenceFreshness, EvidenceState, RANDCORE_HEALTH_DOMAINS } from './health-evidence.js'

export const RANDCORE_FULL_HEALTH_GATE_VERSION = 1

const fail = (reasons, reason) => { if (reason && !reasons.includes(reason)) reasons.push(reason) }

export function evaluateRandCoreFullHealthGate(snapshot, { expectedCommitSha = null } = {}) {
  const reasons = []
  const coverage = snapshot?.coverage || {}
  const domains = snapshot?.domains || {}

  if (Number(coverage.total_domains) !== RANDCORE_HEALTH_DOMAINS.length) fail(reasons, 'domain-contract-mismatch')
  if (Number(coverage.verified_domains) !== RANDCORE_HEALTH_DOMAINS.length) fail(reasons, 'coverage-not-7-of-7')
  if (Number(coverage.stale_domains) !== 0) fail(reasons, 'stale-evidence-present')
  if (Number(coverage.unknown_domains) !== 0) fail(reasons, 'unknown-evidence-present')
  if (snapshot?.status !== 'HEALTHY') fail(reasons, 'aggregate-not-healthy')
  if (Number(snapshot?.score) !== 100) fail(reasons, 'aggregate-score-not-100')
  if (Number(snapshot?.confidence) !== 100) fail(reasons, 'aggregate-confidence-not-100')

  for (const domain of RANDCORE_HEALTH_DOMAINS) {
    const evidence = domains[domain]
    if (!evidence) { fail(reasons, `${domain}:missing`); continue }
    if (evidence.state !== EvidenceState.VERIFIED) fail(reasons, `${domain}:not-verified`)
    if (evidence.freshness !== EvidenceFreshness.FRESH) fail(reasons, `${domain}:not-fresh`)
    if (evidence.status !== 'HEALTHY') fail(reasons, `${domain}:not-healthy`)
    if (Number(evidence.score) !== 100) fail(reasons, `${domain}:score-not-100`)
  }

  const backup = domains.backup_restore?.evidence || {}
  if (backup.restore_verified !== true) fail(reasons, 'backup_restore:restore-not-verified')
  if (backup.isolated !== true || backup.production_mutated !== false) fail(reasons, 'backup_restore:isolation-not-proven')

  const integrations = domains.integrations?.evidence || {}
  if (integrations.probe !== 'operational-trace') fail(reasons, 'integrations:operational-proof-missing')

  if (expectedCommitSha) {
    for (const domain of ['deploy','dependencies']) {
      if (domains[domain]?.evidence?.commit_sha !== expectedCommitSha) fail(reasons, `${domain}:commit-mismatch`)
    }
  }

  return Object.freeze({
    version:RANDCORE_FULL_HEALTH_GATE_VERSION,
    passed:reasons.length === 0,
    status:reasons.length === 0 ? 'FULL_HEALTHY' : 'BLOCKED',
    score:Number(snapshot?.score || 0),
    confidence:Number(snapshot?.confidence || 0),
    coverage:`${Number(coverage.verified_domains || 0)}/${RANDCORE_HEALTH_DOMAINS.length}`,
    reasons:Object.freeze(reasons),
  })
}

export function assertRandCoreFullHealthGate(snapshot, options = {}) {
  const result = evaluateRandCoreFullHealthGate(snapshot, options)
  if (!result.passed) throw new Error(`randcore-full-health-gate:${result.reasons.join(',')}`)
  return result
}
