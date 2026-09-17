/** Pure release gate: no network, deploy or filesystem side effects. */
export const WEB_RELEASE_EVIDENCE_KEYS = Object.freeze([
  'quality', 'build', 'audit', 'e2e', 'device',
  'rollback', 'environmentSeparation', 'humanReview',
])

export const TARGET_RELEASE_EVIDENCE_KEYS = Object.freeze({
  web: Object.freeze([]),
  android: Object.freeze(['signedPackage', 'realDevice']),
})

export function releaseEvidenceKeys(target = 'web') {
  const targetKeys = TARGET_RELEASE_EVIDENCE_KEYS[target]
  if (!targetKeys) throw new Error(`Unsupported release target: ${target}`)
  return Object.freeze([...WEB_RELEASE_EVIDENCE_KEYS, ...targetKeys])
}

export function evaluateReleaseReadiness(evidence = {}, { target = 'web' } = {}) {
  const keys = releaseEvidenceKeys(target)
  const missing = keys.filter((key) => evidence[key] !== true)
  return {
    target,
    status: missing.length === 0 ? 'READY' : 'BLOCKED',
    missing,
    evidence: Object.fromEntries(keys.map((key) => [key, evidence[key] === true])),
  }
}
