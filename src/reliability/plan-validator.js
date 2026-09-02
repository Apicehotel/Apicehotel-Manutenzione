import { validatePlan } from '../randai/runtime/contracts.js'

const RISK = new Set(['low', 'medium', 'high', 'critical'])

export function validateExecutionPlan({ plan, hotelId, availableTools = [], permissions = [], prerequisites = {} } = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  if (!plan?.id) throw new TypeError('plan.id is required')
  validatePlan(plan)

  const toolSet = new Set(availableTools)
  const permissionSet = new Set(permissions)
  const issues = []

  for (const step of plan.steps) {
    if (step.hotelId && step.hotelId !== hotelId) issues.push({ code: 'HOTEL_SCOPE_MISMATCH', stepId: step.id })
    const strategies = step.strategies || (step.action ? [step.action] : [])
    for (const strategy of strategies) {
      if (!toolSet.has(strategy.toolId)) issues.push({ code: 'TOOL_UNAVAILABLE', stepId: step.id, toolId: strategy.toolId })
    }
    if (step.permission && !permissionSet.has(step.permission)) issues.push({ code: 'PERMISSION_MISSING', stepId: step.id, permission: step.permission })
    if (!RISK.has(step.risk || 'low')) issues.push({ code: 'INVALID_RISK', stepId: step.id })
    for (const key of step.requires || []) if (!prerequisites[key]) issues.push({ code: 'PREREQUISITE_MISSING', stepId: step.id, prerequisite: key })
  }

  return { ok: issues.length === 0, issues, planId: plan.id, hotelId }
}

export function assertExecutionPlan(input) {
  const result = validateExecutionPlan(input)
  if (!result.ok) {
    const error = new Error('Execution plan rejected')
    error.code = 'PLAN_VALIDATION_FAILED'
    error.issues = result.issues
    throw error
  }
  return result
}
