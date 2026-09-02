function normalize(value) { return String(value || '').trim().toLowerCase() }

const CAUSES = Object.freeze({
  PERMISSION: new Set(['permission_denied', 'auth_error', 'unauthorized', 'forbidden']),
  CONCURRENCY: new Set(['revision_conflict', 'version_conflict', 'conflict']),
  NETWORK: new Set(['timeout', 'network_error', 'tool_unavailable', 'rate_limit']),
  VALIDATION: new Set(['invalid_input', 'validation_failed', 'plan_validation_failed']),
  VERIFICATION: new Set(['verification_failed', 'readback_mismatch']),
})

export function classifyRootCause(code) {
  const normalized = normalize(code)
  for (const [cause, codes] of Object.entries(CAUSES)) if (codes.has(normalized)) return cause
  return 'UNKNOWN'
}

export function failureFingerprint({ hotelId, component, code, operation, resourceType } = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  return [hotelId, component, operation, resourceType, code].map(normalize).join('|')
}

export class FailureIntelligence {
  constructor() { this.groups = new Map() }

  ingest(event = {}) {
    if (!event.hotelId) throw new TypeError('failure event requires hotelId')
    const fingerprint = failureFingerprint(event)
    const current = this.groups.get(fingerprint) || {
      fingerprint,
      hotelId: event.hotelId,
      component: event.component || null,
      operation: event.operation || null,
      resourceType: event.resourceType || null,
      rootCause: classifyRootCause(event.code),
      count: 0,
      firstSeenAt: null,
      lastSeenAt: null,
      codes: new Set(),
      recoveries: new Map(),
    }
    const at = event.at || new Date().toISOString()
    current.count += 1
    current.firstSeenAt ||= at
    current.lastSeenAt = at
    if (event.code) current.codes.add(event.code)
    if (event.recovery?.action) {
      const stats = current.recoveries.get(event.recovery.action) || { attempts: 0, successes: 0 }
      stats.attempts += 1
      if (event.recovery.ok) stats.successes += 1
      current.recoveries.set(event.recovery.action, stats)
    }
    this.groups.set(fingerprint, current)
    return this.describe(fingerprint)
  }

  describe(fingerprint) {
    const group = this.groups.get(fingerprint)
    if (!group) return null
    const ranked = [...group.recoveries.entries()].sort((a, b) => {
      const rateA = a[1].attempts ? a[1].successes / a[1].attempts : 0
      const rateB = b[1].attempts ? b[1].successes / b[1].attempts : 0
      return rateB - rateA || b[1].successes - a[1].successes
    })
    const bestRecovery = ranked[0]?.[1].successes > 0 ? ranked[0][0] : null
    return {
      fingerprint: group.fingerprint,
      hotelId: group.hotelId,
      component: group.component,
      operation: group.operation,
      resourceType: group.resourceType,
      rootCause: group.rootCause,
      count: group.count,
      firstSeenAt: group.firstSeenAt,
      lastSeenAt: group.lastSeenAt,
      codes: [...group.codes],
      recurring: group.count >= 2,
      bestRecovery,
    }
  }

  list({ hotelId } = {}) {
    if (!hotelId) throw new TypeError('hotelId is required')
    return [...this.groups.values()]
      .filter((group) => group.hotelId === hotelId)
      .map((group) => this.describe(group.fingerprint))
      .sort((a, b) => b.count - a.count)
  }
}
