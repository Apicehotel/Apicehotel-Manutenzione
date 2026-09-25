export const RANDAPP_FREEZE = Object.freeze({
  status: 'FROZEN',
  releaseLine: 'RandApp LTS 1.0',
  maintenanceHorizonMonths: 12,
  allowedChangeTypes: Object.freeze(['bugfix', 'security', 'recovery', 'docs']),
  exceptionalChangeTypes: Object.freeze(['feature', 'architecture', 'schema', 'dependency-major']),
})

export function evaluateFrozenChange({
  changeType,
  humanReview = false,
  directMain = false,
  exceptionApproved = false,
  rollbackPlan = false,
  releaseGatePassed = false,
} = {}) {
  if (directMain) return Object.freeze({ allowed: false, code: 'DIRECT_MAIN_FORBIDDEN' })
  if (!humanReview) return Object.freeze({ allowed: false, code: 'HUMAN_REVIEW_REQUIRED' })

  if (RANDAPP_FREEZE.allowedChangeTypes.includes(changeType)) {
    return Object.freeze({ allowed: true, code: 'MAINTENANCE_CHANGE_ALLOWED' })
  }

  if (
    RANDAPP_FREEZE.exceptionalChangeTypes.includes(changeType)
    && exceptionApproved
    && rollbackPlan
    && releaseGatePassed
  ) {
    return Object.freeze({ allowed: true, code: 'EXCEPTION_APPROVED' })
  }

  return Object.freeze({ allowed: false, code: 'FREEZE_BLOCKED' })
}
