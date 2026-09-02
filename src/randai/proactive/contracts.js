export const SignalSeverity = Object.freeze({ INFO:'INFO', LOW:'LOW', MEDIUM:'MEDIUM', HIGH:'HIGH', CRITICAL:'CRITICAL' })
export const SignalStatus = Object.freeze({ OPEN:'OPEN', SUPPRESSED:'SUPPRESSED', PROPOSED:'PROPOSED', ACTIONED:'ACTIONED', BLOCKED:'BLOCKED', RESOLVED:'RESOLVED' })
export const ProactiveDecision = Object.freeze({ IGNORE:'IGNORE', PROPOSE:'PROPOSE', ACT:'ACT', BLOCK:'BLOCK' })
export const SEVERITY_ORDER = Object.freeze(['INFO','LOW','MEDIUM','HIGH','CRITICAL'])

export function normalizeSignalScope({ hotelId = null, global = false } = {}) {
  const scopedHotel = String(hotelId || '').trim() || null
  if (scopedHotel && global) throw new TypeError('Signal scope cannot be both hotel and global')
  return { hotelId: scopedHotel, global: scopedHotel ? false : Boolean(global) }
}

export function validateSignal(signal) {
  if (!signal?.id || !signal?.projectId || !signal?.type || !signal?.fingerprint) throw new TypeError('Signal requires id, projectId, type and fingerprint')
  if (!Object.values(SignalSeverity).includes(signal.severity)) throw new TypeError(`Invalid signal severity: ${signal.severity}`)
  if (!Object.values(SignalStatus).includes(signal.status)) throw new TypeError(`Invalid signal status: ${signal.status}`)
  const scope = normalizeSignalScope(signal)
  if (!scope.hotelId && !scope.global) throw new TypeError('Signal requires hotelId or explicit global scope')
}
