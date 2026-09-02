export const SupervisorMode = Object.freeze({ SINGLE_AGENT: 'SINGLE_AGENT', MULTI_AGENT: 'MULTI_AGENT', DISCOVERY_REQUIRED: 'DISCOVERY_REQUIRED', STOPPED: 'STOPPED' })
export const SupervisorStatus = Object.freeze({ PLANNED: 'PLANNED', RUNNING: 'RUNNING', NEEDS_REVIEW: 'NEEDS_REVIEW', BLOCKED: 'BLOCKED', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', STOPPED: 'STOPPED' })
export const SupervisorStopReason = Object.freeze({ BUDGET_EXCEEDED: 'BUDGET_EXCEEDED', REPEATED_FAILURE: 'REPEATED_FAILURE', CAPABILITY_GAP: 'CAPABILITY_GAP', QUALITY_GATE: 'QUALITY_GATE', EXECUTION_FAILED: 'EXECUTION_FAILED' })

export function validateSupervisorBudget(budget) {
  const integerFields = ['maxAgents', 'maxConcurrency', 'maxToolCalls', 'maxRetries']
  for (const field of integerFields) {
    const value = Number(budget?.[field])
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`Invalid supervisor budget: ${field}`)
  }
  const cost = Number(budget?.maxCost)
  if (!Number.isFinite(cost) || cost < 0) throw new TypeError('Invalid supervisor budget: maxCost')
  if (Number(budget.maxConcurrency) > Number(budget.maxAgents)) throw new TypeError('maxConcurrency cannot exceed maxAgents')
  return true
}
