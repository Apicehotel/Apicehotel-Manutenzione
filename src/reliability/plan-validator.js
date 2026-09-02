const RISK = new Set(['low','medium','high','critical'])

function assertArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${name} must be a non-empty array`)
}

export function validateExecutionPlan({ plan, hotelId, availableTools = [], permissions = [], prerequisites = {} } = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  if (!plan?.id) throw new TypeError('plan.id is required')
  assertArray(plan.steps, 'plan.steps')
  const toolSet = new Set(availableTools)
  const permissionSet = new Set(permissions)
  const ids = new Set()
  const issues = []

  for (const step of plan.steps) {
    if (!step?.id || ids.has(step.id)) issues.push({ code: 'INVALID_STEP_ID', stepId: step?.id || null })
    else ids.add(step.id)
    if (step.hotelId && step.hotelId !== hotelId) issues.push({ code: 'HOTEL_SCOPE_MISMATCH', stepId: step.id })
    if (!step.toolId || !toolSet.has(step.toolId)) issues.push({ code: 'TOOL_UNAVAILABLE', stepId: step.id, toolId: step.toolId || null })
    if (step.permission && !permissionSet.has(step.permission)) issues.push({ code: 'PERMISSION_MISSING', stepId: step.id, permission: step.permission })
    if (!RISK.has(step.risk || 'low')) issues.push({ code: 'INVALID_RISK', stepId: step.id })
    for (const key of step.requires || []) if (!prerequisites[key]) issues.push({ code: 'PREREQUISITE_MISSING', stepId: step.id, prerequisite: key })
  }

  for (const step of plan.steps) {
    for (const dep of step.dependsOn || []) {
      if (!ids.has(dep) || dep === step.id) issues.push({ code: 'INVALID_DEPENDENCY', stepId: step.id, dependency: dep })
    }
  }

  const visiting = new Set(), visited = new Set()
  const byId = new Map(plan.steps.map((s) => [s.id, s]))
  const visit = (id) => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const dep of byId.get(id)?.dependsOn || []) if (byId.has(dep) && visit(dep)) return true
    visiting.delete(id); visited.add(id); return false
  }
  if ([...ids].some(visit)) issues.push({ code: 'DEPENDENCY_CYCLE' })

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
