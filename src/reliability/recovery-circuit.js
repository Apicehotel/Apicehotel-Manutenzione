const STATES = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' })

function positiveInt(value, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new TypeError(`${name} must be an integer >= 1`)
  return n
}

function finiteNonNegative(value, name) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new TypeError(`${name} must be finite and >= 0`)
  return n
}

export class RecoveryBudget {
  constructor({ maxAttempts = 6, maxElapsedMs = 120000, maxCostUnits = 20, startedAt = Date.now() } = {}) {
    this.maxAttempts = positiveInt(maxAttempts, 'maxAttempts')
    this.maxElapsedMs = positiveInt(maxElapsedMs, 'maxElapsedMs')
    this.maxCostUnits = finiteNonNegative(maxCostUnits, 'maxCostUnits')
    this.startedAt = Number(startedAt)
    if (!Number.isFinite(this.startedAt)) throw new TypeError('startedAt must be finite')
    this.attempts = 0
    this.costUnits = 0
  }

  canSpend({ costUnits = 0, now = Date.now() } = {}) {
    const cost = finiteNonNegative(costUnits, 'costUnits')
    if (this.attempts >= this.maxAttempts) return { allowed: false, reason: 'ATTEMPT_BUDGET_EXHAUSTED' }
    if (Number(now) - this.startedAt > this.maxElapsedMs) return { allowed: false, reason: 'TIME_BUDGET_EXHAUSTED' }
    if (this.costUnits + cost > this.maxCostUnits) return { allowed: false, reason: 'COST_BUDGET_EXHAUSTED' }
    return { allowed: true }
  }

  spend({ costUnits = 0, now = Date.now() } = {}) {
    const allowed = this.canSpend({ costUnits, now })
    if (!allowed.allowed) return allowed
    this.attempts += 1
    this.costUnits += finiteNonNegative(costUnits, 'costUnits')
    return { allowed: true, attempts: this.attempts, costUnits: this.costUnits }
  }

  snapshot(now = Date.now()) {
    return { attempts: this.attempts, maxAttempts: this.maxAttempts, costUnits: this.costUnits, maxCostUnits: this.maxCostUnits, elapsedMs: Math.max(0, Number(now) - this.startedAt), maxElapsedMs: this.maxElapsedMs }
  }
}

export class RecoveryCircuit {
  constructor({ maxFailures = 3, cooldownMs = 30000 } = {}) {
    this.maxFailures = positiveInt(maxFailures, 'maxFailures')
    this.cooldownMs = positiveInt(cooldownMs, 'cooldownMs')
    this.state = STATES.CLOSED
    this.failures = 0
    this.openedAt = null
    this.halfOpenProbeUsed = false
  }

  beforeAttempt(now = Date.now()) {
    if (this.state === STATES.OPEN) {
      if (Number(now) - this.openedAt < this.cooldownMs) return { allowed: false, state: this.state, reason: 'CIRCUIT_OPEN' }
      this.state = STATES.HALF_OPEN
      this.halfOpenProbeUsed = false
    }
    if (this.state === STATES.HALF_OPEN) {
      if (this.halfOpenProbeUsed) return { allowed: false, state: this.state, reason: 'HALF_OPEN_PROBE_IN_FLIGHT' }
      this.halfOpenProbeUsed = true
    }
    return { allowed: true, state: this.state }
  }

  recordSuccess() {
    this.state = STATES.CLOSED
    this.failures = 0
    this.openedAt = null
    this.halfOpenProbeUsed = false
    return this.snapshot()
  }

  recordFailure(now = Date.now()) {
    this.failures += 1
    if (this.state === STATES.HALF_OPEN || this.failures >= this.maxFailures) {
      this.state = STATES.OPEN
      this.openedAt = Number(now)
      this.halfOpenProbeUsed = false
    }
    return this.snapshot()
  }

  snapshot() {
    return { state: this.state, failures: this.failures, openedAt: this.openedAt, halfOpenProbeUsed: this.halfOpenProbeUsed }
  }
}

export function authorizeRecoveryAttempt({ budget, circuit, costUnits = 0, now = Date.now() } = {}) {
  if (!(budget instanceof RecoveryBudget)) throw new TypeError('budget must be RecoveryBudget')
  if (!(circuit instanceof RecoveryCircuit)) throw new TypeError('circuit must be RecoveryCircuit')
  const circuitDecision = circuit.beforeAttempt(now)
  if (!circuitDecision.allowed) return circuitDecision
  const budgetDecision = budget.spend({ costUnits, now })
  if (!budgetDecision.allowed) return { ...budgetDecision, state: circuit.state }
  return { allowed: true, state: circuit.state, budget: budget.snapshot(now) }
}

export { STATES as RecoveryCircuitState }
