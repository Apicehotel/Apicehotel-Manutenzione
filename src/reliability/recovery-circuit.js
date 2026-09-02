const STATES = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' })

function positiveInt(value, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new TypeError(`${name} must be an integer >= 1`)
  return n
}

export class RecoveryCircuit {
  constructor({ maxAttempts = 3, maxFailures = 4, cooldownMs = 30000 } = {}) {
    this.maxAttempts = positiveInt(maxAttempts, 'maxAttempts')
    this.maxFailures = positiveInt(maxFailures, 'maxFailures')
    this.cooldownMs = positiveInt(cooldownMs, 'cooldownMs')
    this.state = STATES.CLOSED
    this.failures = 0
    this.attempts = 0
    this.openedAt = null
  }

  beforeAttempt(now = Date.now()) {
    if (this.state === STATES.OPEN) {
      if (now - this.openedAt < this.cooldownMs) return { allowed: false, state: this.state, reason: 'CIRCUIT_OPEN' }
      this.state = STATES.HALF_OPEN
    }
    if (this.attempts >= this.maxAttempts) return { allowed: false, state: this.state, reason: 'ATTEMPT_BUDGET_EXHAUSTED' }
    this.attempts += 1
    return { allowed: true, state: this.state }
  }

  recordSuccess() {
    this.state = STATES.CLOSED
    this.failures = 0
    this.attempts = 0
    this.openedAt = null
    return this.snapshot()
  }

  recordFailure(now = Date.now()) {
    this.failures += 1
    if (this.state === STATES.HALF_OPEN || this.failures >= this.maxFailures) {
      this.state = STATES.OPEN
      this.openedAt = now
    }
    return this.snapshot()
  }

  snapshot() {
    return { state: this.state, failures: this.failures, attempts: this.attempts, openedAt: this.openedAt }
  }
}

export { STATES as RecoveryCircuitState }
