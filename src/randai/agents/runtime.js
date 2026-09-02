import { AgentRunStatus, validateAgentTask } from './contracts.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()
const positiveInteger = (value, name) => {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1) throw new TypeError(`${name} must be an integer >= 1`)
  return numeric
}

function validateDependencyGraph(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const visiting = new Set()
  const visited = new Set()
  const visit = (id) => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new TypeError(`Agent dependency cycle detected at task ${id}`)
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependsOn || []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const task of tasks) visit(task.id)
}

export class MultiAgentRuntime {
  constructor({ registry, invokeAgent, maxAgents = 5, maxConcurrency = 3, eventSink = null } = {}) {
    if (!registry?.findByRole) throw new TypeError('MultiAgentRuntime requires an AgentRegistry')
    if (typeof invokeAgent !== 'function') throw new TypeError('MultiAgentRuntime requires invokeAgent')
    if (eventSink != null && typeof eventSink !== 'function') throw new TypeError('eventSink must be a function')
    this.registry = registry
    this.invokeAgent = invokeAgent
    this.maxAgents = positiveInteger(maxAgents, 'maxAgents')
    this.maxConcurrency = positiveInteger(maxConcurrency, 'maxConcurrency')
    this.eventSink = eventSink
  }

  async run({ objective, tasks = [], context = {}, preferSingleAgent = false } = {}) {
    if (!String(objective || '').trim()) throw new TypeError('objective is required')
    if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array')
    tasks.forEach(validateAgentTask)
    if (new Set(tasks.map((task) => task.id)).size !== tasks.length) throw new TypeError('Agent task ids must be unique')
    if (tasks.length > this.maxAgents) throw new Error(`Agent task limit exceeded: ${tasks.length}/${this.maxAgents}`)
    const knownIds = new Set(tasks.map((task) => task.id))
    for (const task of tasks) {
      const dependencies = task.dependsOn || []
      if (new Set(dependencies).size !== dependencies.length) throw new TypeError(`Duplicate dependencies for task ${task.id}`)
      for (const dependency of dependencies) {
        if (!knownIds.has(dependency)) throw new TypeError(`Unknown dependency ${dependency} for task ${task.id}`)
        if (dependency === task.id) throw new TypeError(`Task ${task.id} cannot depend on itself`)
      }
    }
    validateDependencyGraph(tasks)

    const trace = []
    const emit = async (type, data = {}) => {
      const event = { type, at: nowIso(), ...clone(data) }
      trace.push(event)
      if (this.eventSink) await this.eventSink(event)
    }
    const results = {}
    const statuses = Object.fromEntries(tasks.map((task) => [task.id, AgentRunStatus.PENDING]))
    await emit('MULTI_AGENT_STARTED', { objective, taskCount: tasks.length })

    if (preferSingleAgent && tasks.length === 1) await emit('SINGLE_AGENT_SELECTED', { taskId: tasks[0].id })

    while (Object.values(statuses).includes(AgentRunStatus.PENDING)) {
      const ready = tasks.filter((task) => statuses[task.id] === AgentRunStatus.PENDING && (task.dependsOn || []).every((id) => statuses[id] === AgentRunStatus.SUCCEEDED))
      if (!ready.length) {
        const blocked = tasks.filter((item) => statuses[item.id] === AgentRunStatus.PENDING)
        for (const task of blocked) statuses[task.id] = AgentRunStatus.SKIPPED
        await emit('DEPENDENCY_BLOCKED', { taskIds: blocked.map((task) => task.id) })
        break
      }
      const batch = ready.slice(0, this.maxConcurrency)
      await Promise.all(batch.map(async (task) => {
        const agent = this.registry.findByRole(task.agentRole)
        if (!agent) {
          statuses[task.id] = AgentRunStatus.FAILED
          results[task.id] = { ok: false, error: `No enabled agent for role ${task.agentRole}` }
          await emit('AGENT_FAILED', { taskId: task.id, role: task.agentRole, reason: 'AGENT_NOT_FOUND' })
          return
        }
        statuses[task.id] = AgentRunStatus.RUNNING
        await emit('AGENT_STARTED', { taskId: task.id, agentId: agent.id, role: agent.role })
        try {
          const dependencyResults = Object.fromEntries((task.dependsOn || []).map((id) => [id, clone(results[id]?.output)]))
          const output = await this.invokeAgent({ agent, task: clone(task), objective, context: clone(context), dependencyResults })
          statuses[task.id] = AgentRunStatus.SUCCEEDED
          results[task.id] = { ok: true, agentId: agent.id, output: clone(output) }
          await emit('HANDOFF_COMPLETED', { taskId: task.id, agentId: agent.id })
        } catch (error) {
          statuses[task.id] = AgentRunStatus.FAILED
          results[task.id] = { ok: false, agentId: agent.id, error: error?.message || String(error) }
          await emit('AGENT_FAILED', { taskId: task.id, agentId: agent.id, reason: results[task.id].error })
        }
      }))
      if (batch.some((task) => statuses[task.id] === AgentRunStatus.FAILED)) {
        const blocked = tasks.filter((item) => statuses[item.id] === AgentRunStatus.PENDING)
        for (const task of blocked) statuses[task.id] = AgentRunStatus.SKIPPED
        if (blocked.length) await emit('DEPENDENCY_BLOCKED', { taskIds: blocked.map((task) => task.id), reason: 'UPSTREAM_FAILED' })
        break
      }
    }

    const failed = Object.values(statuses).some((status) => status === AgentRunStatus.FAILED)
    const completed = Object.values(statuses).filter((status) => status === AgentRunStatus.SUCCEEDED).length
    await emit('MULTI_AGENT_COMPLETED', { ok: !failed, completed, total: tasks.length })
    return { ok: !failed, objective, statuses: clone(statuses), results: clone(results), trace, metrics: { agentsRequested: tasks.length, agentsCompleted: completed, maxConcurrency: this.maxConcurrency } }
  }
}
