export const SoftwareRunStatus = Object.freeze({
  ANALYZING: 'ANALYZING', RUNNING: 'RUNNING', BLOCKED: 'BLOCKED', FAILED: 'FAILED',
  VERIFYING: 'VERIFYING', READY_FOR_REVIEW: 'READY_FOR_REVIEW', SUCCEEDED: 'SUCCEEDED',
})

export const SoftwareStage = Object.freeze({
  LOCALIZE: 'LOCALIZE', PLAN: 'PLAN', EDIT: 'EDIT', BUILD: 'BUILD', TEST: 'TEST', REVIEW: 'REVIEW', DELIVER: 'DELIVER',
})

export function validateSoftwareSpec(spec) {
  if (!spec?.objective?.trim() || !spec?.projectId) throw new TypeError('Software spec requires objective and projectId')
  if (!Array.isArray(spec.targetNodeIds)) throw new TypeError('targetNodeIds must be an array')
  if (!spec.proposedPlan?.steps?.length) throw new TypeError('Software spec requires a proposedPlan')
  return true
}
