export const AgentRole = Object.freeze({ ORCHESTRATOR: 'ORCHESTRATOR', RESEARCHER: 'RESEARCHER', BUILDER: 'BUILDER', TESTER: 'TESTER', REVIEWER: 'REVIEWER' })
export const AgentRunStatus = Object.freeze({ PENDING: 'PENDING', RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', SKIPPED: 'SKIPPED' })

function validateStringArray(value, name) {
  if (value == null) return
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`)
  if (value.some((item) => !String(item || '').trim())) throw new TypeError(`${name} must contain non-empty values`)
  if (new Set(value).size !== value.length) throw new TypeError(`${name} must not contain duplicates`)
}

export function validateAgent(agent) {
  if (!agent?.id || !agent?.role || !agent?.instructions) throw new TypeError('Agent requires id, role and instructions')
  if (!Object.values(AgentRole).includes(agent.role)) throw new TypeError(`Invalid agent role: ${agent.role}`)
  validateStringArray(agent.tools, 'Agent tools')
  if (agent.modelRequest != null && (typeof agent.modelRequest !== 'object' || Array.isArray(agent.modelRequest))) throw new TypeError('modelRequest must be an object')
  if (agent.enabled != null && typeof agent.enabled !== 'boolean') throw new TypeError('enabled must be boolean')
  return true
}

export function validateAgentTask(task) {
  if (!task?.id || !task?.objective || !task?.agentRole) throw new TypeError('Agent task requires id, objective and agentRole')
  if (!Object.values(AgentRole).includes(task.agentRole)) throw new TypeError(`Invalid agent role: ${task.agentRole}`)
  validateStringArray(task.dependsOn, 'dependsOn')
  validateStringArray(task.requiredTools, 'requiredTools')
  if (task.hotelId != null && !String(task.hotelId).trim()) throw new TypeError('hotelId must be non-empty when supplied')
  return true
}
