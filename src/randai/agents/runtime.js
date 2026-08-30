import { AgentRunStatus, validateAgentTask } from './contracts.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()

export class MultiAgentRuntime {
  constructor({ registry, invokeAgent, maxAgents = 5, maxConcurrency = 3, eventSink = null } = {}) {
    if (!registry?.findByRole) throw new TypeError('MultiAgentRuntime requires an AgentRegistry')
    if (typeof invokeAgent !== 'function') throw new TypeError('MultiAgentRuntime requires invokeAgent')
    this.registry = registry
    this.invokeAgent = invokeAgent
    this.maxAgents = Math.max(1, Number(maxAgents || 5))
    this.maxConcurrency = Math.max(1, Number(maxConcurrency || 3))
    this.eventSink = eventSink
  }

  async run({ objective, tasks = [], context = {}, preferSingleAgent = false } = {}) {
    if (!String(objective || '').trim()) throw new TypeError('objective is required')
    tasks.forEach(validateAgentTask)
    if (tasks.length > this.maxAgents) throw new Error(`Agent task limit exceeded: ${tasks.length}/${this.maxAgents}`)
    const trace = []
    const emit = (type, data = {}) => {
      const event = { type, at: nowIso(), ...clone(data) }
      trace.push(event)
      this.eventSink?.(event)
    }
    const results = {}
    const statuses = Object.fromEntries(tasks.map((task) => [task.id, AgentRunStatus.PENDING]))
    emit('MULTI_AGENT_STARTED', { objective, taskCount: tasks.length })

    if (preferSingleAgent && tasks.length === 1) emit('SINGLE_AGENT_SELECTED', { taskId: tasks[0].id })

    while (Object.values(statuses).includes(AgentRunStatus.PENDING)) {
      const ready = tasks.filter((task) => statuses[task.id] === AgentRunStatus.PENDING && (task.dependsOn || []).every((id) => statuses[id] === AgentRunStatus.SUCCEEDED))
      if (!ready.length) {
        for (const task of tasks.filter((item) => statuses[item.id] === AgentRunStatus.PENDING)) statuses[task.id] = AgentRunStatus.SKIPPED
        emit('DEPENDENCY_BLOCKED')
        break
      }
      const batch = ready.slice(0, this.maxConcurrency)
      await Promise.all(batch.map(async (task) => {
        const agent = this.registry.findByRole(task.agentRole)
        if (!agent) {
          statuses[task.id] = AgentRunStatus.FAILED
          results[task.id] = { ok: false, error: `No enabled agent for role ${task.agentRole}` }
          emit('AGENT_FAILED', { taskId: task.id, role: task.agentRole, reason: 'AGENT_NOT_FOUND' })
          return
        }
        statuses[task.id] = AgentRunStatus.RUNNING
        emit('AGENT_STARTED', { taskId: task.id, agentId: agent.id, role: agent.role })
        try {
          const dependencyResults = Object.fromEntries((task.dependsOn || []).map((id) => [id, clone(results[id]?.output)]))
          const output = await this.invokeAgent({ agent, task: clone(task), objective, context: clone(context), dependencyResults })
          statuses[task.id] = AgentRunStatus.SUCCEEDED
          results[task.id] = { ok: true, agentId: agent.id, output: clone(output) }
          emit('HANDOFF_COMPLETED', { taskId: task.id, agentId: agent.id })
        } catch (error) {
          statuses[task.id] = AgentRunStatus.FAILED
          results[task.id] = { ok: false, agentId: agent.id, error: error?.message || String(error) }
          emit('AGENT_FAILED', { taskId: task.id, agentId: agent.id, reason: results[task.id].error })
        }
      }))
      if (batch.some((task) => statuses[task.id] === AgentRunStatus.FAILED)) break
    }

    const failed = Object.values(statuses).some((status) => status === AgentRunStatus.FAILED)
    const completed = Object.values(statuses).filter((status) => status === AgentRunStatus.SUCCEEDED).length
    emit('MULTI_AGENT_COMPLETED', { ok: !failed, completed, total: tasks.length })
    return { ok: !failed, objective, statuses: clone(statuses), results: clone(results), trace, metrics: { agentsRequested: tasks.length, agentsCompleted: completed, maxConcurrency: this.maxConcurrency } }
  }
}
