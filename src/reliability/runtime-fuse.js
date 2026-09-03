const text = (value) => String(value ?? '').trim()

export const RuntimeFuseState = Object.freeze({
  ARMED: 'ARMED',
  PAUSED: 'PAUSED',
  TRIPPED: 'TRIPPED',
})

export class RuntimeCapabilityFuse {
  constructor({ fuseId, hotelIds = [], module = null, capability = null } = {}) {
    if (!text(fuseId)) throw new TypeError('fuseId is required')
    this.fuseId = text(fuseId)
    this.hotelIds = new Set(hotelIds.map(text).filter(Boolean))
    this.module = text(module) || null
    this.capability = text(capability) || null
    this.state = RuntimeFuseState.ARMED
    this.reason = null
    this.changedAt = Date.now()
  }

  appliesTo({ hotelId, module = null, capability = null } = {}) {
    const scopedHotel = text(hotelId)
    if (!scopedHotel) throw new TypeError('hotelId is required')
    if (this.hotelIds.size && !this.hotelIds.has(scopedHotel)) return false
    if (this.module && text(module) !== this.module) return false
    if (this.capability && text(capability) !== this.capability) return false
    return true
  }

  evaluate(context = {}) {
    if (!this.appliesTo(context)) return Object.freeze({ allowed: true, state: this.state, applies: false })
    if (this.state === RuntimeFuseState.ARMED) return Object.freeze({ allowed: true, state: this.state, applies: true })
    return Object.freeze({ allowed: false, state: this.state, applies: true, reason: this.reason || this.state })
  }

  pause(reason = 'MANUAL_PAUSE') {
    if (this.state !== RuntimeFuseState.TRIPPED) {
      this.state = RuntimeFuseState.PAUSED
      this.reason = text(reason) || 'MANUAL_PAUSE'
      this.changedAt = Date.now()
    }
    return this.snapshot()
  }

  trip(reason = 'EMERGENCY_STOP') {
    this.state = RuntimeFuseState.TRIPPED
    this.reason = text(reason) || 'EMERGENCY_STOP'
    this.changedAt = Date.now()
    return this.snapshot()
  }

  reset({ authorized = false, reason = 'AUTHORIZED_RESET' } = {}) {
    if (authorized !== true) {
      const error = new Error('RUNTIME_FUSE_RESET_NOT_AUTHORIZED')
      error.code = 'RUNTIME_FUSE_RESET_NOT_AUTHORIZED'
      throw error
    }
    this.state = RuntimeFuseState.ARMED
    this.reason = text(reason) || 'AUTHORIZED_RESET'
    this.changedAt = Date.now()
    return this.snapshot()
  }

  snapshot() {
    return Object.freeze({
      fuseId: this.fuseId,
      state: this.state,
      reason: this.reason,
      changedAt: this.changedAt,
      hotelIds: Object.freeze([...this.hotelIds]),
      module: this.module,
      capability: this.capability,
    })
  }
}
