export const SoftwareRunStatus = Object.freeze({
  ANALYZING: 'ANALYZING', RUNNING: 'RUNNING', BLOCKED: 'BLOCKED', FAILED: 'FAILED',
  VERIFYING: 'VERIFYING', READY_FOR_REVIEW: 'READY_FOR_REVIEW', SUCCEEDED: 'SUCCEEDED',
})

export const SoftwareStage = Object.freeze({
  LOCALIZE: 'LOCALIZE', PLAN: 'PLAN', EDIT: 'EDIT', BUILD: 'BUILD', TEST: 'TEST', REVIEW: 'REVIEW', DELIVER: 'DELIVER',
})

export function validateSoftwareSpec(spec) {
  if (!spec?.objective?.trim() || !String(spec?.projectId || '').trim()) throw new TypeError('Software spec requires objective and projectId')
  if (!Array.isArray(spec.targetNodeIds)) throw new TypeError('targetNodeIds must be an array')
  if (spec.targetNodeIds.some((id) => !String(id || '').trim())) throw new TypeError('targetNodeIds must contain non-empty ids')
  if (new Set(spec.targetNodeIds).size !== spec.targetNodeIds.length) throw new TypeError('targetNodeIds must be unique')
  if (!spec.proposedPlan?.steps?.length) throw new TypeError('Software spec requires a proposedPlan')
  if (spec.metadata != null && (typeof spec.metadata !== 'object' || Array.isArray(spec.metadata))) throw new TypeError('Software spec metadata must be an object')
  return true
}
