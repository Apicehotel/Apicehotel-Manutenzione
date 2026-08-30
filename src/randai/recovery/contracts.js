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
})

export function failureFingerprint({ stepId = '', strategyId = '', toolId = '', code = '', reason = '' } = {}) {
  return [stepId, strategyId, toolId, code, String(reason).slice(0, 200)].join('|')
}
