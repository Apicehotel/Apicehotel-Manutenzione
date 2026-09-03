import { SupervisorMode, SupervisorStatus, SupervisorStopReason, validateSupervisorBudget } from './contracts.js'
import { SupervisorStore } from './store.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()
const makeId = () => `SUP-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

function threshold(value, name) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new TypeError(`${name} must be between 0 and 1`)
  return numeric
}

function positiveInteger(value, name) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1) throw new TypeError(`${name} must be an integer >= 1`)
  return numeric
}

function metric(value, name) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError(`Invalid supervisor metric: ${name}`)
  return numeric
}

export class RandAISupervisor {
  constructor({ discovery = null, multiAgentRuntime = null, multiAgentCoordinator = null, store = new SupervisorStore(), eventSink = null, onTelemetryError = null, qualityThreshold = 0.8, repeatedFailureLimit = 3, defaultBudget = {} } = {}) {
    if (eventSink != null && typeof eventSink !== 'function') throw new TypeError('eventSink must be a function')
    if (onTelemetryError != null && typeof onTelemetryError !== 'function') throw new TypeError('onTelemetryError must be a function')
    this.discovery = discovery; this.multiAgentRuntime = multiAgentRuntime; this.multiAgentCoordinator = multiAgentCoordinator; this.store = store; this.eventSink = eventSink; this.onTelemetryError = onTelemetryError
    this.qualityThreshold = threshold(qualityThreshold, 'qualityThreshold')
    this.repeatedFailureLimit = positiveInteger(repeatedFailureLimit, 'repeatedFailureLimit')
    const defaults = { maxAgents: 5, maxConcurrency: 3, maxToolCalls: 40, maxRetries: 5, maxCost: 10 }
    this.defaultBudget = { ...defaults, ...defaultBudget }
    if (defaultBudget.maxConcurrency == null && this.defaultBudget.maxConcurrency > this.defaultBudget.maxAgents) this.defaultBudget.maxConcurrency = this.defaultBudget.maxAgents
    validateSupervisorBudget(this.defaultBudget)
    this.failures = new Map()
  }

  plan({ objective, complexity = 'LOW', capabilityGaps = [], agentTasks = [], budget = {} } = {}) {
    if (!String(objective || '').trim()) throw new TypeError('objective is required')
    if (!Array.isArray(capabilityGaps) || !Array.isArray(agentTasks)) throw new TypeError('capabilityGaps and agentTasks must be arrays')
    const effectiveBudget = { ...this.defaultBudget, ...budget }; validateSupervisorBudget(effectiveBudget)
    if (capabilityGaps.length) return { mode: SupervisorMode.DISCOVERY_REQUIRED, objective, capabilityGaps: [...capabilityGaps], budget: effectiveBudget, reason: SupervisorStopReason.CAPABILITY_GAP }
    const wantsMulti = agentTasks.length > 1
    if (agentTasks.length > effectiveBudget.maxAgents) return { mode: SupervisorMode.STOPPED, objective, budget: effectiveBudget, reason: SupervisorStopReason.BUDGET_EXCEEDED }
    return { mode: wantsMulti ? SupervisorMode.MULTI_AGENT : SupervisorMode.SINGLE_AGENT, objective, complexity, agentTasks: clone(agentTasks), budget: effectiveBudget }
  }

  async run({ objective, projectId = 'randai', hotelId = null, taskId = null, complexity = 'LOW', capabilityGaps = [], agentTasks = [], budget = {}, executeSingle = null, context = {} } = {}) {
    const contextHotel = String(context?.hotelId || '').trim() || null
    const requestedHotel = String(hotelId || '').trim() || null
    if (requestedHotel && contextHotel && requestedHotel !== contextHotel) throw new Error(`Supervisor hotel scope mismatch: ${requestedHotel} != ${contextHotel}`)
    const scopedHotel = requestedHotel || contextHotel
    const plan = this.plan({ objective, complexity, capabilityGaps, agentTasks, budget })
    const run = { id: makeId(), projectId, hotelId: scopedHotel, taskId, objective, mode: plan.mode, status: SupervisorStatus.PLANNED, budget: plan.budget, events: [], metrics: { agents: 0, toolCalls: 0, retries: 0, cost: 0 }, result: null, recommendations: [], stopReason: plan.reason || null, createdAt: nowIso(), updatedAt: nowIso(), completedAt: null }
    const emit = async (type, data = {}) => {
      const event = { type, at: nowIso(), projectId, hotelId: scopedHotel, taskId, ...clone(data) }
      run.events.push(event)
      if (this.eventSink) {
        try { await this.eventSink(event) }
        catch (error) { if (this.onTelemetryError) await this.onTelemetryError({ event: clone(event), error }) }
      }
    }
    await emit('SUPERVISOR_PLANNED', { mode: run.mode })

    if (plan.mode === SupervisorMode.STOPPED) return this.#finish(run, SupervisorStatus.STOPPED)
    if (plan.mode === SupervisorMode.DISCOVERY_REQUIRED) {
      run.status = SupervisorStatus.BLOCKED
      if (this.discovery) {
        for (const gap of capabilityGaps) {
          const found = await this.discovery.discover({ query: gap, projectId })
          run.recommendations.push(...found.map((item) => ({ id: item.id, name: item.name, status: item.status, source: item.source })))
        }
      }
      await emit('CAPABILITY_DISCOVERY_REQUIRED', { gaps: capabilityGaps, discovered: run.recommendations.length })
      return this.#finish(run, SupervisorStatus.BLOCKED)
    }

    run.status = SupervisorStatus.RUNNING; await this.store.save(run); await emit('SUPERVISOR_STARTED')
    try {
      let execution
      if (plan.mode === SupervisorMode.MULTI_AGENT) {
        const coordinator = this.multiAgentCoordinator || this.multiAgentRuntime
        if (!coordinator) throw new Error('Multi-agent runtime is not configured')
        execution = await coordinator.run({ objective, tasks: agentTasks, context: { ...clone(context), hotelId: scopedHotel } })
      } else {
        if (typeof executeSingle !== 'function') throw new Error('Single-agent executor is not configured')
        execution = await executeSingle({ objective, context: { ...clone(context), hotelId: scopedHotel }, budget: clone(plan.budget) })
      }
      run.result = clone(execution)
      const metrics = execution?.metrics || {}
      run.metrics = {
        agents: metric(metrics.agentsRequested ?? metrics.agents ?? (plan.mode === SupervisorMode.SINGLE_AGENT ? 1 : 0), 'agents'),
        toolCalls: metric(metrics.toolCalls, 'toolCalls'),
        retries: metric(metrics.retries, 'retries'),
        cost: metric(metrics.cost, 'cost'),
      }
      const exceeded = run.metrics.agents > plan.budget.maxAgents || run.metrics.toolCalls > plan.budget.maxToolCalls || run.metrics.retries > plan.budget.maxRetries || run.metrics.cost > plan.budget.maxCost
      if (exceeded) { run.stopReason = SupervisorStopReason.BUDGET_EXCEEDED; await emit('SUPERVISOR_BUDGET_EXCEEDED', { metrics: run.metrics }); return this.#finish(run, SupervisorStatus.STOPPED) }
      if (execution?.ok === false) { run.stopReason = SupervisorStopReason.EXECUTION_FAILED; await emit('SUPERVISOR_EXECUTION_FAILED'); return this.#finish(run, SupervisorStatus.FAILED) }
      const quality = threshold(execution?.evaluation?.score ?? execution?.qualityScore ?? 1, 'execution quality')
      if (quality < this.qualityThreshold) { run.stopReason = SupervisorStopReason.QUALITY_GATE; await emit('QUALITY_GATE_FAILED', { quality, threshold: this.qualityThreshold }); return this.#finish(run, SupervisorStatus.NEEDS_REVIEW) }
      await emit('SUPERVISOR_COMPLETED', { quality })
      return this.#finish(run, SupervisorStatus.SUCCEEDED)
    } catch (error) {
      run.result = { error: error?.message || String(error) }; run.stopReason = SupervisorStopReason.EXECUTION_FAILED
      await emit('SUPERVISOR_ERROR', { message: run.result.error })
      return this.#finish(run, SupervisorStatus.FAILED)
    }
  }

  recordFailure({ fingerprint, projectId = 'randai', hotelId = null, context = {} } = {}) {
    if (!fingerprint) throw new TypeError('failure fingerprint is required')
    const scopedHotel = String(hotelId || context?.hotelId || '').trim() || 'global'
    const key = `${projectId}::${scopedHotel}::${fingerprint}`
    const count = (this.failures.get(key) || 0) + 1; this.failures.set(key, count)
    return { fingerprint, projectId, hotelId: scopedHotel === 'global' ? null : scopedHotel, count, stop: count >= this.repeatedFailureLimit, reason: count >= this.repeatedFailureLimit ? SupervisorStopReason.REPEATED_FAILURE : null, context: clone(context) }
  }

  async #finish(run, status) { run.status = status; run.updatedAt = nowIso(); run.completedAt = [SupervisorStatus.RUNNING, SupervisorStatus.PLANNED].includes(status) ? null : run.updatedAt; await this.store.save(run); return clone(run) }
}
