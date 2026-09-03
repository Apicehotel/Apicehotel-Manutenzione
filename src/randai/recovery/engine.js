import { ToolStatus } from '../tools/contracts.js'
import { FailureClass, RecoveryAction, RecoveryDisposition, failureFingerprint } from './contracts.js'
import { authorizeRecoveryAttempt } from '../../reliability/recovery-circuit.js'
import { classifyRootCause } from '../../reliability/failure-intelligence.js'

const transient = new Set(['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMIT', 'TOOL_UNAVAILABLE'])
const permission = new Set(['PERMISSION_DENIED', 'AUTH_ERROR'])
const positiveInteger = (value, name) => {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1) throw new TypeError(`${name} must be an integer >= 1`)
  return numeric
}

export class RecoveryEngine {
  constructor({ maxSameStrategyAttempts = 2, maxTotalRecoveries = 6, maxRepeatedFingerprint = 2 } = {}) {
    this.maxSameStrategyAttempts = positiveInteger(maxSameStrategyAttempts, 'maxSameStrategyAttempts')
    this.maxTotalRecoveries = positiveInteger(maxTotalRecoveries, 'maxTotalRecoveries')
    this.maxRepeatedFingerprint = positiveInteger(maxRepeatedFingerprint, 'maxRepeatedFingerprint')
  }

  classify({ result, verification, error } = {}) {
    const code = error?.code || result?.error?.code || ''
    const reason = String(verification?.reason || error?.message || result?.error?.message || '').toLowerCase()
    if (reason.includes('unsafe') || reason.includes('safety')) return FailureClass.SAFETY
    if (permission.has(code) || result?.status === ToolStatus.PERMISSION_DENIED) return FailureClass.PERMISSION
    if (code === 'INVALID_INPUT') return FailureClass.INVALID_INPUT
    if (transient.has(code) || result?.status === ToolStatus.RETRYABLE || result?.retryable === true) return FailureClass.TRANSIENT
    if (verification?.ok === false) return FailureClass.VERIFICATION
    if (reason.includes('dependency')) return FailureClass.DEPENDENCY
    return FailureClass.UNKNOWN
  }

  decide({ task, step, state, strategy, result, verification, error } = {}) {
    if (!task || !step || !state || !strategy) throw new TypeError('Recovery decision requires task, step, state and strategy')
    if (step.hotelId && task.metadata?.hotelId && step.hotelId !== task.metadata.hotelId) throw new Error(`Recovery hotel scope mismatch for step ${step.id}`)
    const failureClass = this.classify({ result, verification, error })
    const code = error?.code || result?.error?.code || result?.status || 'UNKNOWN'
    const reason = verification?.reason || error?.message || result?.error?.message || 'failure'
    const fingerprint = failureFingerprint({ stepId: step?.id, strategyId: strategy?.id || state?.strategyIndex, toolId: strategy?.toolId, code, reason })
    const history = task?.recoveryHistory || []
    const repeats = history.filter((item) => item.fingerprint === fingerprint).length
    if (history.length >= this.maxTotalRecoveries) return { action: RecoveryAction.STOP, failureClass, reason: 'RECOVERY_BUDGET_EXHAUSTED', fingerprint }
    if (repeats >= this.maxRepeatedFingerprint) return { action: RecoveryAction.STOP, failureClass, reason: 'ANTI_LOOP_REPEATED_FAILURE', fingerprint }
    if (failureClass === FailureClass.PERMISSION || failureClass === FailureClass.SAFETY) return { action: RecoveryAction.ASK_HUMAN, failureClass, reason, fingerprint }
    if (failureClass === FailureClass.INVALID_INPUT) return { action: RecoveryAction.STOP, failureClass, reason: 'INVALID_INPUT_REQUIRES_REPLAN', fingerprint }
    if (failureClass === FailureClass.TRANSIENT && Number(state?.attempts || 0) < this.maxSameStrategyAttempts) return { action: RecoveryAction.RETRY_SAME, failureClass, reason, fingerprint }
    if (Number(state?.strategyIndex || 0) + 1 < Number(step?.strategies?.length || 0)) return { action: RecoveryAction.SWITCH_STRATEGY, failureClass, reason, fingerprint }
    if (strategy?.rollback) return { action: RecoveryAction.ROLLBACK, failureClass, reason, fingerprint, rollback: strategy.rollback }
    return { action: RecoveryAction.STOP, failureClass, reason, fingerprint }
  }

  record(task, decision, details = {}) {
    if (!task || !decision?.action || !decision?.fingerprint) throw new TypeError('Recovery record requires task and a valid decision')
    task.recoveryHistory ||= []
    const at = new Date().toISOString()
    const event = { at, ...decision, ...details, hotelId: task.metadata?.hotelId || null }
    task.recoveryHistory.push(event)
    task.decisions ||= []
    task.decisions.push({ at, type: 'RECOVERY_DECISION', action: decision.action, failureClass: decision.failureClass, reason: decision.reason, stepId: details.stepId || null, hotelId: task.metadata?.hotelId || null })
    return event
  }
}


function recoveryPlan(disposition, action, reason, extra = {}) {
  return Object.freeze({ disposition, action, reason, retryable: disposition === RecoveryDisposition.RETRY || disposition === RecoveryDisposition.RECONCILE, ...extra })
}

/**
 * Chooses a bounded recovery without mutating data or inventing a handler.
 * The existing RecoveryEngine remains the single recovery authority.
 */
export function planRecovery({
  hotelId,
  code,
  operation = null,
  permission = 'READ',
  idempotent = false,
  reversible = false,
  verificationRequired = true,
  bestRecovery = null,
  previousAttempts = 0,
  maxAttempts = 3,
  circuitState = 'CLOSED',
  contextValid = true,
} = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  if (!code) throw new TypeError('failure code is required')
  if (!contextValid) return recoveryPlan(RecoveryDisposition.STOP, RecoveryAction.STOP, 'CONTEXT_SCOPE_INVALID')
  if (circuitState === 'OPEN') return recoveryPlan(RecoveryDisposition.STOP, RecoveryAction.STOP, 'CIRCUIT_OPEN')
  if (previousAttempts >= maxAttempts) return recoveryPlan(RecoveryDisposition.STOP, RecoveryAction.STOP, 'RECOVERY_ATTEMPTS_EXHAUSTED')

  const cause = classifyRootCause(code)
  if (cause === 'PERMISSION') return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'PERMISSION_FAILURE_REQUIRES_HUMAN')
  if (cause === 'VALIDATION') return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'VALIDATION_FAILURE_REQUIRES_INPUT_FIX')
  if (cause === 'VERIFICATION') return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'VERIFICATION_FAILURE_REQUIRES_REVIEW')
  if (cause === 'UNKNOWN') return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'UNKNOWN_FAILURE_REQUIRES_REVIEW')
  if (cause === 'CONCURRENCY') {
    if (!idempotent && !reversible) return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'NON_IDEMPOTENT_CONFLICT')
    return recoveryPlan(RecoveryDisposition.RECONCILE, RecoveryAction.RECONCILE_THEN_RETRY, 'CONCURRENCY_REQUIRES_RECONCILIATION', { verificationRequired })
  }
  if (cause === 'NETWORK') {
    if (permission !== 'READ' && !idempotent) return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'NON_IDEMPOTENT_NETWORK_FAILURE')
    const action = bestRecovery === RecoveryAction.REFRESH_CONTEXT ? RecoveryAction.REFRESH_CONTEXT : RecoveryAction.RETRY_READ
    return recoveryPlan(RecoveryDisposition.RETRY, action, 'TRANSIENT_FAILURE_RETRY_ALLOWED', { verificationRequired })
  }
  if (String(operation || '').toLowerCase().includes('write') && !reversible) {
    return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'NON_REVERSIBLE_WRITE_REQUIRES_REVIEW')
  }
  return recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'NO_SAFE_RECOVERY')
}

/**
 * Executes exactly one recovery attempt through the existing budget and circuit.
 * A recovery is successful only after its optional verifier returns true.
 */
export async function executeRecovery({
  failure,
  budget,
  circuit,
  handlers = {},
  verify = null,
  failureIntelligence = null,
  now = Date.now(),
} = {}) {
  if (!failure?.hotelId) throw new TypeError('failure.hotelId is required')
  if (!budget || !circuit) throw new TypeError('budget and circuit are required')
  if (verify != null && typeof verify !== 'function') throw new TypeError('verify must be a function')

  const initialPlan = planRecovery({ ...failure, circuitState: circuit.state })
  if (initialPlan.verificationRequired && !verify && initialPlan.disposition !== RecoveryDisposition.REVIEW && initialPlan.disposition !== RecoveryDisposition.STOP) {
    const reviewPlan = recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'RECOVERY_VERIFIER_MISSING')
    return { status: 'NEEDS_REVIEW', plan: reviewPlan, budget: budget.snapshot(now), circuit: circuit.snapshot() }
  }
  if (initialPlan.disposition === RecoveryDisposition.REVIEW || initialPlan.disposition === RecoveryDisposition.STOP) {
    return { status: initialPlan.disposition === RecoveryDisposition.REVIEW ? 'NEEDS_REVIEW' : 'STOPPED', plan: initialPlan, budget: budget.snapshot(now), circuit: circuit.snapshot() }
  }

  const handler = handlers[initialPlan.action]
  if (typeof handler !== 'function') {
    const reviewPlan = recoveryPlan(RecoveryDisposition.REVIEW, RecoveryAction.MANUAL_REVIEW, 'RECOVERY_HANDLER_MISSING')
    return { status: 'NEEDS_REVIEW', plan: reviewPlan, budget: budget.snapshot(now), circuit: circuit.snapshot() }
  }

  const authorization = authorizeRecoveryAttempt({ budget, circuit, costUnits: failure.costUnits || 0, now })
  if (!authorization.allowed) {
    const stopPlan = recoveryPlan(RecoveryDisposition.STOP, RecoveryAction.STOP, authorization.reason)
    return { status: 'STOPPED', plan: stopPlan, authorization, budget: budget.snapshot(now), circuit: circuit.snapshot() }
  }

  let output
  let ok = false
  let error = null
  try {
    output = await handler({ failure: { ...failure }, plan: initialPlan, authorization })
    ok = output?.ok !== false
    if (ok && verify) ok = (await verify({ output, failure: { ...failure }, plan: initialPlan })) === true
    if (!ok) error = new Error('RECOVERY_VERIFICATION_FAILED')
  } catch (cause) {
    error = cause
  }

  if (ok) {
    circuit.recordSuccess()
    if (failureIntelligence?.ingest) failureIntelligence.ingest({ ...failure, recovery: { action: initialPlan.action, ok: true } })
    return { status: 'RECOVERED', plan: initialPlan, output, budget: budget.snapshot(now), circuit: circuit.snapshot() }
  }

  circuit.recordFailure(now)
  if (failureIntelligence?.ingest) failureIntelligence.ingest({ ...failure, recovery: { action: initialPlan.action, ok: false } })
  return { status: 'FAILED', plan: initialPlan, error: error?.message || String(error || 'recovery_failed'), budget: budget.snapshot(now), circuit: circuit.snapshot() }
}
