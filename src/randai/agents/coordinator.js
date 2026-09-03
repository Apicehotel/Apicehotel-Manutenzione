import { AgentRunStatus } from './contracts.js'

const clone = (value) => value == null ? value : structuredClone(value)
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const stable = (value) => {
  if (value == null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
}

function claimOf(output) {
  if (!output || typeof output !== 'object') return null
  for (const field of ['decision', 'conclusion', 'recommendation', 'outcome']) {
    if (output[field] != null) return { field, value: clone(output[field]), key: stable(output[field]) }
  }
  return null
}

export class MultiAgentCoordinator {
  constructor({ runtime, minAgreement = 0.67 } = {}) {
    if (!runtime?.run) throw new TypeError('MultiAgentCoordinator requires a runtime')
    const agreement = finite(minAgreement, -1)
    if (agreement < 0 || agreement > 1) throw new TypeError('minAgreement must be between 0 and 1')
    this.runtime = runtime
    this.minAgreement = agreement
  }

  async run({ objective, tasks = [], context = {}, requiredRoles = [], minAgreement = this.minAgreement } = {}) {
    if (!String(context?.hotelId || '').trim()) throw new TypeError('Multi-agent coordination requires explicit hotelId scope')
    const threshold = finite(minAgreement, -1)
    if (threshold < 0 || threshold > 1) throw new TypeError('minAgreement must be between 0 and 1')
    const execution = await this.runtime.run({ objective, tasks, context })
    const successful = Object.entries(execution.results || {}).filter(([, result]) => result?.ok && result?.output != null)
    const roles = new Map(tasks.map((task) => [task.id, task.agentRole]))
    const missingRoles = [...new Set(requiredRoles)].filter((role) => !successful.some(([taskId]) => roles.get(taskId) === role))
    const groups = new Map()
    for (const [taskId, result] of successful) {
      const claim = claimOf(result.output)
      if (!claim) continue
      const group = groups.get(claim.key) || { key: claim.key, value: claim.value, taskIds: [], fields: [] }
      group.taskIds.push(taskId)
      group.fields.push(claim.field)
      groups.set(claim.key, group)
    }
    const ranked = [...groups.values()].sort((a, b) => b.taskIds.length - a.taskIds.length || a.key.localeCompare(b.key))
    const claimCount = ranked.reduce((sum, group) => sum + group.taskIds.length, 0)
    const winner = ranked[0] || null
    const agreement = claimCount ? Number((winner.taskIds.length / claimCount).toFixed(4)) : null
    const hasConsensus = Boolean(execution.ok && winner && agreement >= threshold && missingRoles.length === 0)
    const status = !execution.ok ? 'FAILED' : hasConsensus ? 'CONSENSUS' : 'NEEDS_REVIEW'
    return {
      ok: status === 'CONSENSUS',
      status,
      objective,
      hotelId: context.hotelId,
      decision: hasConsensus ? clone(winner.value) : null,
      consensus: { reached: hasConsensus, agreement, threshold, claims: claimCount, alternatives: Math.max(0, ranked.length - 1), missingRoles },
      conflicts: ranked.slice(1).map((group) => ({ value: clone(group.value), taskIds: [...group.taskIds] })),
      results: clone(execution.results || {}),
      statuses: clone(execution.statuses || {}),
      trace: clone(execution.trace || []),
      metrics: { ...(execution.metrics || {}), consensusReached: hasConsensus, claims: claimCount, conflicts: Math.max(0, ranked.length - 1) },
    }
  }
}
