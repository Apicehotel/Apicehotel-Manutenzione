export const SignalSeverity = Object.freeze({ INFO:'INFO', LOW:'LOW', MEDIUM:'MEDIUM', HIGH:'HIGH', CRITICAL:'CRITICAL' })
export const SignalStatus = Object.freeze({ OPEN:'OPEN', SUPPRESSED:'SUPPRESSED', PROPOSED:'PROPOSED', ACTIONED:'ACTIONED', BLOCKED:'BLOCKED', RESOLVED:'RESOLVED' })
export const ProactiveDecision = Object.freeze({ IGNORE:'IGNORE', PROPOSE:'PROPOSE', ACT:'ACT', BLOCK:'BLOCK' })
export const SEVERITY_ORDER = Object.freeze(['INFO','LOW','MEDIUM','HIGH','CRITICAL'])

export function validateSignal(signal) {
  if (!signal?.id || !signal?.projectId || !signal?.type || !signal?.fingerprint) throw new TypeError('Signal requires id, projectId, type and fingerprint')
  if (!Object.values(SignalSeverity).includes(signal.severity)) throw new TypeError(`Invalid signal severity: ${signal.severity}`)
  if (!Object.values(SignalStatus).includes(signal.status)) throw new TypeError(`Invalid signal status: ${signal.status}`)
}
