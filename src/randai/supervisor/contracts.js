export const SupervisorMode = Object.freeze({ SINGLE_AGENT: 'SINGLE_AGENT', MULTI_AGENT: 'MULTI_AGENT', DISCOVERY_REQUIRED: 'DISCOVERY_REQUIRED', STOPPED: 'STOPPED' })
export const SupervisorStatus = Object.freeze({ PLANNED: 'PLANNED', RUNNING: 'RUNNING', NEEDS_REVIEW: 'NEEDS_REVIEW', BLOCKED: 'BLOCKED', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', STOPPED: 'STOPPED' })
export const SupervisorStopReason = Object.freeze({ BUDGET_EXCEEDED: 'BUDGET_EXCEEDED', REPEATED_FAILURE: 'REPEATED_FAILURE', CAPABILITY_GAP: 'CAPABILITY_GAP', QUALITY_GATE: 'QUALITY_GATE', EXECUTION_FAILED: 'EXECUTION_FAILED', INVALID_TASK_GRAPH: 'INVALID_TASK_GRAPH' })

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

export function validateSupervisorTaskGraph(tasks = []) {
  if (!Array.isArray(tasks)) throw new TypeError('agentTasks must be an array')
  const ids = new Set()
  for (const task of tasks) {
    if (!task || typeof task !== 'object' || !String(task.id || '').trim()) throw new TypeError('Every supervisor task requires an id')
    if (ids.has(task.id)) throw new TypeError(`Duplicate supervisor task id: ${task.id}`)
    ids.add(task.id)
    if (task.dependsOn != null && !Array.isArray(task.dependsOn)) throw new TypeError(`dependsOn must be an array for task ${task.id}`)
    if (new Set(task.dependsOn || []).size !== (task.dependsOn || []).length) throw new TypeError(`Duplicate dependencies for task ${task.id}`)
  }
  const visiting = new Set()
  const visited = new Set()
  const visit = (id) => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new TypeError(`Supervisor dependency cycle detected at task ${id}`)
    const task = tasks.find((item) => item.id === id)
    if (!task) throw new TypeError(`Unknown supervisor dependency: ${id}`)
    visiting.add(id)
    for (const dependency of task.dependsOn || []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const task of tasks) visit(task.id)
  return true
}
