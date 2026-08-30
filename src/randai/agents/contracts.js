export const AgentRole = Object.freeze({ ORCHESTRATOR: 'ORCHESTRATOR', RESEARCHER: 'RESEARCHER', BUILDER: 'BUILDER', TESTER: 'TESTER', REVIEWER: 'REVIEWER' })
export const AgentRunStatus = Object.freeze({ PENDING: 'PENDING', RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED', SKIPPED: 'SKIPPED' })

export function validateAgent(agent) {
  if (!agent?.id || !agent?.role || !agent?.instructions) throw new TypeError('Agent requires id, role and instructions')
  if (!Object.values(AgentRole).includes(agent.role)) throw new TypeError(`Invalid agent role: ${agent.role}`)
  if (agent.tools != null && !Array.isArray(agent.tools)) throw new TypeError('Agent tools must be an array')
  return true
}

export function validateAgentTask(task) {
  if (!task?.id || !task?.objective || !task?.agentRole) throw new TypeError('Agent task requires id, objective and agentRole')
  if (task.dependsOn != null && !Array.isArray(task.dependsOn)) throw new TypeError('dependsOn must be an array')
  return true
}
