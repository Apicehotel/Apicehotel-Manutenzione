function normalize(value) { return String(value || '').trim().toLowerCase() }

export function failureFingerprint({ hotelId, component, code, operation, resourceType } = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  return [hotelId, component, operation, resourceType, code].map(normalize).join('|')
}

export class FailureIntelligence {
  constructor() { this.groups = new Map() }

  ingest(event = {}) {
    if (!event.hotelId) throw new TypeError('failure event requires hotelId')
    const fingerprint = failureFingerprint(event)
    const current = this.groups.get(fingerprint) || { fingerprint, hotelId: event.hotelId, count: 0, firstSeenAt: null, lastSeenAt: null, codes: new Set(), recoveries: new Map() }
    const at = event.at || new Date().toISOString()
    current.count += 1
    current.firstSeenAt ||= at
    current.lastSeenAt = at
    if (event.code) current.codes.add(event.code)
    if (event.recovery?.action) current.recoveries.set(event.recovery.action, (current.recoveries.get(event.recovery.action) || 0) + (event.recovery.ok ? 1 : 0))
    this.groups.set(fingerprint, current)
    return this.describe(fingerprint)
  }

  describe(fingerprint) {
    const group = this.groups.get(fingerprint)
    if (!group) return null
    const bestRecovery = [...group.recoveries.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || null
    return { fingerprint: group.fingerprint, hotelId: group.hotelId, count: group.count, firstSeenAt: group.firstSeenAt, lastSeenAt: group.lastSeenAt, codes: [...group.codes], recurring: group.count >= 2, bestRecovery }
  }

  list({ hotelId } = {}) {
    if (!hotelId) throw new TypeError('hotelId is required')
    return [...this.groups.values()].filter((g) => g.hotelId === hotelId).map((g) => this.describe(g.fingerprint)).sort((a,b) => b.count - a.count)
  }
}
