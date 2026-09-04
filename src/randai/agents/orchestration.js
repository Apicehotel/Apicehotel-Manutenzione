const clone = (value) => value == null ? value : structuredClone(value)
const nowIso = () => new Date().toISOString()
const nonNegativeInteger = (value, name) => {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 0) throw new TypeError(`${name} must be an integer >= 0`)
  return numeric
}

export const RandAgentStage = Object.freeze({
  RECEIVED: 'RECEIVED',
  CONTEXT_LOADED: 'CONTEXT_LOADED',
  PLANNED: 'PLANNED',
  POLICY_CHECKED: 'POLICY_CHECKED',
  EXECUTED: 'EXECUTED',
  INSPECTED: 'INSPECTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
})

export class RandAgentPolicyError extends Error {
  constructor(message = 'RandAgent execution denied by policy') {
    super(message)
    this.name = 'RandAgentPolicyError'
    this.code = 'RAND_AGENT_POLICY_DENIED'
  }
}

export class RandAgentInspectionError extends Error {
  constructor(message = 'RandAgent inspection failed', details = {}) {
    super(message)
    this.name = 'RandAgentInspectionError'
    this.code = 'RAND_AGENT_INSPECTION_FAILED'
    this.details = clone(details)
  }
}

function normalizeInspection(value) {
  if (value == null || value === true) return { ok: true }
  if (value === false) return { ok: false, reason: 'Inspector rejected execution' }
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('inspector must return boolean or an object')
  return { ...clone(value), ok: value.ok !== false }
}

function normalizePlan(value) {
  if (Array.isArray(value)) return { tasks: clone(value) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('planner must return a plan object or task array')
  if (!Array.isArray(value.tasks)) throw new TypeError('planner plan requires tasks array')
  return clone(value)
}

export class RandAgentRuntime {
  constructor({
    executor,
    planner,
    inspector = null,
    verifier = null,
    contextProvider = null,
    continuity = null,
    policyGuard = null,
    eventSink = null,
    onTelemetryError = null,
    maxReplans = 1,
  } = {}) {
    if (!executor?.run || typeof executor.run !== 'function') throw new TypeError('RandAgentRuntime requires an executor with run()')
    if (typeof planner !== 'function') throw new TypeError('RandAgentRuntime requires planner')
    if (inspector != null && typeof inspector !== 'function') throw new TypeError('inspector must be a function')
    if (verifier != null && typeof verifier !== 'function') throw new TypeError('verifier must be a function')
    if (contextProvider != null && typeof contextProvider !== 'function') throw new TypeError('contextProvider must be a function')
    if (continuity != null && (typeof continuity?.open !== 'function' || typeof continuity?.commit !== 'function')) throw new TypeError('continuity must expose open() and commit()')
    if (policyGuard != null && typeof policyGuard !== 'function') throw new TypeError('policyGuard must be a function')
    if (eventSink != null && typeof eventSink !== 'function') throw new TypeError('eventSink must be a function')
    if (onTelemetryError != null && typeof onTelemetryError !== 'function') throw new TypeError('onTelemetryError must be a function')
    this.executor = executor
    this.planner = planner
    this.inspector = inspector || verifier || (async () => ({ ok: true }))
    this.contextProvider = contextProvider
    this.continuity = continuity
    this.policyGuard = policyGuard
    this.eventSink = eventSink
    this.onTelemetryError = onTelemetryError
    this.maxReplans = nonNegativeInteger(maxReplans, 'maxReplans')
  }

  async run({ objective, context = {}, channel = 'internal', metadata = {}, runId = crypto.randomUUID() } = {}) {
    if (!String(objective || '').trim()) throw new TypeError('objective is required')
    if (!String(channel || '').trim()) throw new TypeError('channel is required')
    if (!String(runId || '').trim()) throw new TypeError('runId is required')

    const trace = []
    const emit = async (type, data = {}) => {
      const event = { type, runId, at: nowIso(), ...clone(data) }
      trace.push(event)
      if (!this.eventSink) return
      try { await this.eventSink(clone(event)) }
      catch (error) {
        if (this.onTelemetryError) await this.onTelemetryError({ error, event: clone(event) }).catch(() => undefined)
      }
    }
    const stage = async (value, data = {}) => emit('RAND_AGENT_STAGE', { stage: value, ...data })

    await stage(RandAgentStage.RECEIVED, { objective, channel })
    let resolvedContext = clone(context)
    if (this.contextProvider) {
      const provided = await this.contextProvider({ objective, context: clone(resolvedContext), channel, metadata: clone(metadata), runId })
      if (provided != null) {
        if (typeof provided !== 'object' || Array.isArray(provided)) throw new TypeError('contextProvider must return an object')
        if (resolvedContext?.hotelId && provided?.hotelId && String(resolvedContext.hotelId) !== String(provided.hotelId)) {
          throw new RandAgentPolicyError('contextProvider attempted to change hotel scope')
        }
        resolvedContext = { ...resolvedContext, ...clone(provided) }
      }
    }

    let continuityState = null
    if (this.continuity) {
      const opened = await this.continuity.open({ objective, context: clone(resolvedContext), channel, metadata: clone(metadata), runId })
      if (!opened || typeof opened !== 'object' || Array.isArray(opened)) throw new TypeError('continuity.open must return an object')
      if (opened.context != null && (typeof opened.context !== 'object' || Array.isArray(opened.context))) throw new TypeError('continuity.open context must be an object')
      if (resolvedContext?.hotelId && opened.context?.hotelId && String(resolvedContext.hotelId) !== String(opened.context.hotelId)) {
        throw new RandAgentPolicyError('continuity attempted to change hotel scope')
      }
      resolvedContext = { ...resolvedContext, ...clone(opened.context || {}) }
      continuityState = clone(opened.state || null)
      await emit('RAND_AGENT_CONTINUITY_OPENED', {
        continuityId: resolvedContext?.randContinuity?.continuityId || resolvedContext?.continuityId || null,
        memoryCount: Array.isArray(resolvedContext?.randContinuity?.memoryIds) ? resolvedContext.randContinuity.memoryIds.length : 0,
      })
    }

    const runtimeContext = { ...resolvedContext, randAgent: { runId, channel, metadata: clone(metadata) } }
    await stage(RandAgentStage.CONTEXT_LOADED, {
      continuityId: runtimeContext?.randContinuity?.continuityId || runtimeContext?.continuityId || null,
    })

    let previousInspection = null
    let lastExecution = null
    let lastPlan = null
    for (let attempt = 0; attempt <= this.maxReplans; attempt += 1) {
      lastPlan = normalizePlan(await this.planner({
        objective,
        context: clone(runtimeContext),
        channel,
        metadata: clone(metadata),
        runId,
        attempt,
        previousInspection: clone(previousInspection),
      }))
      await stage(RandAgentStage.PLANNED, { attempt, taskCount: lastPlan.tasks.length })

      if (this.policyGuard) {
        const policy = await this.policyGuard({ objective, plan: clone(lastPlan), context: clone(runtimeContext), channel, metadata: clone(metadata), runId, attempt })
        const allowed = policy === true || policy == null || (typeof policy === 'object' && policy.allowed !== false)
        await stage(RandAgentStage.POLICY_CHECKED, { attempt, allowed })
        if (!allowed) {
          await stage(RandAgentStage.FAILED, { attempt, reason: 'POLICY_DENIED' })
          throw new RandAgentPolicyError(typeof policy === 'object' && policy.reason ? String(policy.reason) : undefined)
        }
      } else {
        await stage(RandAgentStage.POLICY_CHECKED, { attempt, allowed: true, mode: 'NO_GUARD_CONFIGURED' })
      }

      lastExecution = await this.executor.run({
        objective,
        tasks: clone(lastPlan.tasks),
        context: clone(runtimeContext),
        preferSingleAgent: Boolean(lastPlan.preferSingleAgent),
      })
      await stage(RandAgentStage.EXECUTED, { attempt, ok: Boolean(lastExecution?.ok) })

      previousInspection = normalizeInspection(await this.inspector({
        objective,
        plan: clone(lastPlan),
        execution: clone(lastExecution),
        context: clone(runtimeContext),
        channel,
        metadata: clone(metadata),
        runId,
        attempt,
      }))
      await stage(RandAgentStage.INSPECTED, { attempt, ok: previousInspection.ok })

      if (lastExecution?.ok && previousInspection.ok) {
        let continuityCommit = null
        if (this.continuity) {
          try {
            continuityCommit = await this.continuity.commit({
              objective,
              context: clone(runtimeContext),
              channel,
              metadata: clone(metadata),
              runId,
              plan: clone(lastPlan),
              execution: clone(lastExecution),
              inspection: clone(previousInspection),
            })
            await emit('RAND_AGENT_CONTINUITY_COMMITTED', {
              continuityId: runtimeContext?.randContinuity?.continuityId || runtimeContext?.continuityId || null,
              saved: continuityCommit?.saved === true,
              memoryId: continuityCommit?.memoryId || null,
            })
          } catch (error) {
            continuityCommit = { saved: false, reason: 'COMMIT_FAILED', error: String(error?.message || error) }
            await emit('RAND_AGENT_CONTINUITY_COMMIT_FAILED', {
              continuityId: runtimeContext?.randContinuity?.continuityId || runtimeContext?.continuityId || null,
              error: String(error?.message || error),
            })
          }
        }
        await stage(RandAgentStage.COMPLETED, { attempt, replans: attempt })
        return {
          ok: true,
          runId,
          channel,
          objective,
          attempts: attempt + 1,
          replans: attempt,
          plan: clone(lastPlan),
          execution: clone(lastExecution),
          inspection: clone(previousInspection),
          continuity: this.continuity ? clone({ state: continuityState, commit: continuityCommit }) : null,
          trace,
        }
      }

      if (attempt < this.maxReplans) {
        await emit('RAND_AGENT_REPLAN_REQUESTED', {
          attempt,
          executionOk: Boolean(lastExecution?.ok),
          inspection: clone(previousInspection),
        })
      }
    }

    await stage(RandAgentStage.FAILED, { reason: 'INSPECTION_FAILED', replans: this.maxReplans })
    throw new RandAgentInspectionError(previousInspection?.reason || 'RandAgent inspection failed after bounded replans', {
      runId,
      plan: lastPlan,
      execution: lastExecution,
      inspection: previousInspection,
      trace,
      replans: this.maxReplans,
    })
  }
}
