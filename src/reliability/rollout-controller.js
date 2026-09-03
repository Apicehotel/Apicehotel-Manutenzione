function hash(value) {
  let h = 2166136261
  for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function percent(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new TypeError('percentage must be finite 0..100')
  return n
}

export const RolloutState = Object.freeze({ ACTIVE: 'ACTIVE', PAUSED: 'PAUSED', ROLLED_BACK: 'ROLLED_BACK' })

export class SafeRolloutController {
  constructor({ rolloutId, percentage = 0, hotelIds = [], module = null, maxFailureRate = 0.02, maxVerificationFailureRate = 0.01 } = {}) {
    if (!rolloutId) throw new TypeError('rolloutId is required')
    this.rolloutId = String(rolloutId)
    this.percentage = percent(percentage)
    this.hotelIds = new Set(hotelIds.map(String))
    this.module = module ? String(module) : null
    this.maxFailureRate = Number(maxFailureRate)
    this.maxVerificationFailureRate = Number(maxVerificationFailureRate)
    for (const [name, value] of [['maxFailureRate', this.maxFailureRate], ['maxVerificationFailureRate', this.maxVerificationFailureRate]]) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new TypeError(`${name} must be finite 0..1`)
    }
    this.state = RolloutState.ACTIVE
    this.rollbackReason = null
  }

  eligible({ hotelId, actorId, module = null } = {}) {
    if (this.state !== RolloutState.ACTIVE) return false
    if (!hotelId || !actorId) throw new TypeError('hotelId and actorId are required')
    if (this.hotelIds.size && !this.hotelIds.has(String(hotelId))) return false
    if (this.module && String(module || '') !== this.module) return false
    return (hash(`${this.rolloutId}|${hotelId}|${actorId}`) % 10000) < Math.round(this.percentage * 100)
  }

  evaluateHealth({ failureRate = 0, verificationFailureRate = 0 } = {}) {
    const failure = Number(failureRate)
    const verification = Number(verificationFailureRate)
    if (![failure, verification].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new TypeError('health rates must be finite 0..1')
    if (failure > this.maxFailureRate) return this.rollback('FAILURE_RATE_THRESHOLD')
    if (verification > this.maxVerificationFailureRate) return this.rollback('VERIFICATION_FAILURE_THRESHOLD')
    return this.snapshot()
  }

  pause() { if (this.state === RolloutState.ACTIVE) this.state = RolloutState.PAUSED; return this.snapshot() }
  resume() { if (this.state === RolloutState.PAUSED) this.state = RolloutState.ACTIVE; return this.snapshot() }
  rollback(reason = 'MANUAL_ROLLBACK') { this.state = RolloutState.ROLLED_BACK; this.rollbackReason = String(reason); return this.snapshot() }
  snapshot() { return Object.freeze({ rolloutId: this.rolloutId, percentage: this.percentage, state: this.state, rollbackReason: this.rollbackReason, hotelIds: Object.freeze([...this.hotelIds]), module: this.module }) }
}
