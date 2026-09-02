export const RuntimeTaskStatus = Object.freeze({
  PENDING: 'PENDING', RUNNING: 'RUNNING', PAUSED: 'PAUSED', BLOCKED: 'BLOCKED',
  VERIFYING: 'VERIFYING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', CANCELLED: 'CANCELLED',
})

export const RuntimeStepStatus = Object.freeze({
  PENDING: 'PENDING', RUNNING: 'RUNNING', VERIFYING: 'VERIFYING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', BLOCKED: 'BLOCKED',
})

export const CheckpointKind = Object.freeze({
  PLAN_READY: 'PLAN_READY', STEP_STARTED: 'STEP_STARTED', STEP_COMPLETE: 'STEP_COMPLETE', STEP_FAILED: 'STEP_FAILED',
  VERIFICATION_PASS: 'VERIFICATION_PASS', VERIFICATION_FAIL: 'VERIFICATION_FAIL', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
})

function assertAcyclic(steps) {
  const byId = new Map(steps.map((step) => [step.id, step]))
  const visiting = new Set()
  const visited = new Set()
  const visit = (id) => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new TypeError(`Plan dependency cycle detected at step ${id}`)
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependsOn || []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const step of steps) visit(step.id)
}

export function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) throw new TypeError('Plan requires at least one step')
  const ids = new Set()
  for (const step of plan.steps) {
    if (!step?.id || ids.has(step.id)) throw new TypeError('Every plan step requires a unique id')
    ids.add(step.id)
    if (!step.title) throw new TypeError(`Step ${step.id} requires a title`)
    const strategies = step.strategies || (step.action ? [step.action] : [])
    if (!strategies.length) throw new TypeError(`Step ${step.id} requires at least one strategy`)
    for (const strategy of strategies) if (!strategy?.toolId) throw new TypeError(`Step ${step.id} strategy requires toolId`)
  }
  for (const step of plan.steps) {
    const dependencies = step.dependsOn || []
    if (new Set(dependencies).size !== dependencies.length) throw new TypeError(`Step ${step.id} has duplicate dependencies`)
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) throw new TypeError(`Step ${step.id} depends on unknown step ${dependency}`)
      if (dependency === step.id) throw new TypeError(`Step ${step.id} cannot depend on itself`)
    }
  }
  assertAcyclic(plan.steps)
  return plan
}
