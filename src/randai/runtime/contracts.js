export const RuntimeTaskStatus = Object.freeze({
  PENDING: 'PENDING', RUNNING: 'RUNNING', PAUSED: 'PAUSED', BLOCKED: 'BLOCKED',
  VERIFYING: 'VERIFYING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELLED: 'CANCELLED',
})

export const RuntimeStepStatus = Object.freeze({
  PENDING: 'PENDING', RUNNING: 'RUNNING', VERIFYING: 'VERIFYING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', BLOCKED: 'BLOCKED',
})

export const CheckpointKind = Object.freeze({
  PLAN_READY: 'PLAN_READY', STEP_STARTED: 'STEP_STARTED', STEP_COMPLETE: 'STEP_COMPLETE', STEP_FAILED: 'STEP_FAILED',
  VERIFICATION_PASS: 'VERIFICATION_PASS', VERIFICATION_FAIL: 'VERIFICATION_FAIL', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED',
})

export function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) throw new TypeError('Plan requires at least one step')
  const ids = new Set()
  for (const step of plan.steps) {
    if (!step?.id || ids.has(step.id)) throw new TypeError('Every plan step requires a unique id')
    ids.add(step.id)
    if (!step.title) throw new TypeError(`Step ${step.id} requires a title`)
    const strategies = step.strategies || (step.action ? [step.action] : [])
    if (!strategies.length) throw new TypeError(`Step ${step.id} requires at least one strategy`)
  }
  for (const step of plan.steps) {
    for (const dep of step.dependsOn || []) if (!ids.has(dep)) throw new TypeError(`Step ${step.id} depends on unknown step ${dep}`)
  }
  return plan
}
