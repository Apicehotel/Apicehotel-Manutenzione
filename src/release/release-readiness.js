/** Pure release gate: no network, deploy or filesystem side effects. */
export const RELEASE_EVIDENCE_KEYS = Object.freeze([
  'quality', 'build', 'audit', 'e2e', 'device',
  'rollback', 'environmentSeparation', 'humanReview'
]);

export function evaluateReleaseReadiness(evidence = {}) {
  const missing = RELEASE_EVIDENCE_KEYS.filter((key) => evidence[key] !== true);
  return {
    status: missing.length === 0 ? 'READY' : 'BLOCKED',
    missing,
    evidence: Object.fromEntries(RELEASE_EVIDENCE_KEYS.map((key) => [key, evidence[key] === true]))
  };
}
