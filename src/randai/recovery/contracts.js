export const FailureClass = Object.freeze({
  TRANSIENT: 'TRANSIENT',
  PERMISSION: 'PERMISSION',
  INVALID_INPUT: 'INVALID_INPUT',
  DEPENDENCY: 'DEPENDENCY',
  VERIFICATION: 'VERIFICATION',
  SAFETY: 'SAFETY',
  UNKNOWN: 'UNKNOWN',
})

export const RecoveryAction = Object.freeze({
  RETRY_SAME: 'RETRY_SAME',
  SWITCH_STRATEGY: 'SWITCH_STRATEGY',
  ROLLBACK: 'ROLLBACK',
  ASK_HUMAN: 'ASK_HUMAN',
  STOP: 'STOP',
  RETRY_READ: 'RETRY_READ',
  RECONCILE_THEN_RETRY: 'RECONCILE_THEN_RETRY',
  REFRESH_CONTEXT: 'REFRESH_CONTEXT',
  COMPENSATE_WRITE: 'COMPENSATE_WRITE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
})

export const RecoveryDisposition = Object.freeze({
  RETRY: 'RETRY',
  RECONCILE: 'RECONCILE',
  REVIEW: 'REVIEW',
  STOP: 'STOP',
})

export function failureFingerprint({ stepId = '', strategyId = '', toolId = '', code = '', reason = '' } = {}) {
  return [stepId, strategyId, toolId, code, String(reason).slice(0, 200)].join('|')
}
