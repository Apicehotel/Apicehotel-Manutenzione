import { ToolStatus } from '../tools/contracts.js'
import { FailureClass, RecoveryAction, failureFingerprint } from './contracts.js'

const transient = new Set(['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMIT', 'TOOL_UNAVAILABLE'])
const permission = new Set(['PERMISSION_DENIED', 'AUTH_ERROR'])

export class RecoveryEngine {
  constructor({ maxSameStrategyAttempts = 2, maxTotalRecoveries = 6, maxRepeatedFingerprint = 2 } = {}) {
    this.maxSameStrategyAttempts = maxSameStrategyAttempts
    this.maxTotalRecoveries = maxTotalRecoveries
    this.maxRepeatedFingerprint = maxRepeatedFingerprint
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
    task.recoveryHistory ||= []
    const at = new Date().toISOString()
    const event = { at, ...decision, ...details }
    task.recoveryHistory.push(event)
    task.decisions ||= []
    task.decisions.push({ at, type: 'RECOVERY_DECISION', action: decision.action, failureClass: decision.failureClass, reason: decision.reason, stepId: details.stepId || null })
    return event
  }
}
