import { RuntimeTaskStatus } from '../runtime/contracts.js'
import { SoftwareRunStatus, validateSoftwareSpec } from './contracts.js'
import { assessSoftwareReadiness } from './readiness.js'

const clone = (value) => structuredClone(value)

export class SoftwareEngineeringAgent {
  constructor({ projectIntelligence, durableRunner, reviewer = null, evaluationEngine = null, observability = null } = {}) {
    if (!projectIntelligence || !durableRunner) throw new TypeError('projectIntelligence and durableRunner are required')
    this.projectIntelligence = projectIntelligence
    this.durableRunner = durableRunner
    this.reviewer = reviewer
    this.evaluationEngine = evaluationEngine
    this.observability = observability
  }

  async analyze({ objective, projectId = 'randai', targetNodeIds = [], proposedPlan, metadata = {} } = {}) {
    const spec = { objective: objective?.trim(), projectId, targetNodeIds: [...targetNodeIds], proposedPlan: clone(proposedPlan), metadata: clone(metadata) }
    validateSoftwareSpec(spec)
    const hotelId = String(spec.metadata?.hotelId || '').trim() || null
    const impacts = []
    for (const nodeId of spec.targetNodeIds) {
      const impact = await this.projectIntelligence.impact(projectId, nodeId)
      if (hotelId && impact?.hotelId && impact.hotelId !== hotelId) throw new Error(`Software impact hotel scope mismatch: ${impact.hotelId} != ${hotelId}`)
      impacts.push({ nodeId, impact })
    }
    return { ...spec, status: SoftwareRunStatus.ANALYZING, impacts }
  }

  async prepare({
    objective,
    projectId = 'randai',
    targetNodeIds = [],
    proposedPlan,
    metadata = {},
    availableTools = null,
    permissions = null,
    prerequisites = {},
  } = {}) {
    const spec = await this.analyze({ objective, projectId, targetNodeIds, proposedPlan, metadata })
    const readiness = assessSoftwareReadiness({ spec, availableTools, permissions, prerequisites })
    return { ...spec, status: SoftwareRunStatus.READY_FOR_REVIEW, readiness, stages: ['LOCALIZE', 'PLAN', 'REVIEW'] }
  }

  async execute(spec, { evaluationScenario = null, pauseAfterSteps = Infinity, readiness = null } = {}) {
    validateSoftwareSpec(spec)
    if (readiness && !readiness.ok) {
      return { status: SoftwareRunStatus.BLOCKED, task: null, review: readiness, evaluation: null, traceId: null }
    }
    const hotelId = String(spec.metadata?.hotelId || '').trim() || null
    const trace = this.observability ? await this.observability.startTrace({ name: 'software-engineering', projectId: spec.projectId, hotelId, metadata: { objective: spec.objective } }) : null
    const closeTrace = async (ok, metadata = {}) => {
      if (!trace) return
      try { await this.observability.completeTrace(trace.id, { ok, metadata }) } catch { /* observability must not rewrite task outcome */ }
    }
    try {
      const task = await this.durableRunner.create({ objective: spec.objective, proposedPlan: spec.proposedPlan, metadata: { ...spec.metadata, projectId: spec.projectId, hotelId, targetNodeIds: spec.targetNodeIds } })
      if (trace) {
        try { await this.observability.emit(trace.id, 'SOFTWARE_TASK_CREATED', { taskId: task.id, hotelId }) } catch { /* non-fatal */ }
      }
      const completed = await this.durableRunner.resume(task.id, { pauseAfterSteps })
      if ([RuntimeTaskStatus.BLOCKED, RuntimeTaskStatus.PAUSED].includes(completed.status)) {
        await closeTrace(false, { taskStatus: completed.status })
        return { status: SoftwareRunStatus.BLOCKED, task: completed, review: null, evaluation: null, traceId: trace?.id || null }
      }
      if (completed.status !== RuntimeTaskStatus.SUCCEEDED) {
        await closeTrace(false, { taskStatus: completed.status })
        return { status: SoftwareRunStatus.FAILED, task: completed, review: null, evaluation: null, traceId: trace?.id || null }
      }

      const review = this.reviewer ? await this.reviewer.review({ spec: clone(spec), task: clone(completed), hotelId }) : { ok: true, reason: 'durable_verifier_only' }
      if (!review?.ok) {
        await closeTrace(false, { review: 'failed' })
        return { status: SoftwareRunStatus.FAILED, task: completed, review, evaluation: null, traceId: trace?.id || null }
      }

      let evaluation = null
      if (evaluationScenario) {
        if (!this.evaluationEngine) throw new Error('evaluationEngine is required for evaluationScenario')
        evaluation = await this.evaluationEngine.runScenario(evaluationScenario, { hotelId, projectId: spec.projectId, spec: clone(spec), task: clone(completed), review: clone(review) })
        if (!evaluation.passed) {
          await closeTrace(false, { evaluationId: evaluation.id })
          return { status: SoftwareRunStatus.FAILED, task: completed, review, evaluation, traceId: trace?.id || null }
        }
      }

      if (trace) {
        try { await this.observability.emit(trace.id, 'SOFTWARE_VERIFIED', { taskId: completed.id, evaluationId: evaluation?.id || null, hotelId }) } catch { /* non-fatal */ }
      }
      await closeTrace(true)
      return { status: SoftwareRunStatus.SUCCEEDED, task: completed, review, evaluation, traceId: trace?.id || null }
    } catch (error) {
      await closeTrace(false, { error: error?.message || String(error) })
      throw error
    }
  }
}
