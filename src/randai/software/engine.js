import { RuntimeTaskStatus } from '../runtime/contracts.js'
import { SoftwareRunStatus, validateSoftwareSpec } from './contracts.js'

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
    const impacts = []
    for (const nodeId of spec.targetNodeIds) impacts.push({ nodeId, impact: await this.projectIntelligence.impact(projectId, nodeId) })
    return { ...spec, status: SoftwareRunStatus.ANALYZING, impacts }
  }

  async execute(spec, { evaluationScenario = null, pauseAfterSteps = Infinity } = {}) {
    validateSoftwareSpec(spec)
    const trace = this.observability ? await this.observability.startTrace({ name: 'software-engineering', projectId: spec.projectId, metadata: { objective: spec.objective } }) : null
    const task = await this.durableRunner.create({ objective: spec.objective, proposedPlan: spec.proposedPlan, metadata: { ...spec.metadata, projectId: spec.projectId, targetNodeIds: spec.targetNodeIds } })
    if (trace) await this.observability.emit(trace.id, 'SOFTWARE_TASK_CREATED', { taskId: task.id })
    const completed = await this.durableRunner.resume(task.id, { pauseAfterSteps })
    if ([RuntimeTaskStatus.BLOCKED, RuntimeTaskStatus.PAUSED].includes(completed.status)) {
      if (trace) await this.observability.completeTrace(trace.id, { ok: false, metadata: { taskStatus: completed.status } })
      return { status: SoftwareRunStatus.BLOCKED, task: completed, review: null, evaluation: null, traceId: trace?.id || null }
    }
    if (completed.status !== RuntimeTaskStatus.SUCCEEDED) {
      if (trace) await this.observability.completeTrace(trace.id, { ok: false, metadata: { taskStatus: completed.status } })
      return { status: SoftwareRunStatus.FAILED, task: completed, review: null, evaluation: null, traceId: trace?.id || null }
    }

    const review = this.reviewer ? await this.reviewer.review({ spec: clone(spec), task: clone(completed) }) : { ok: true, reason: 'no_reviewer_configured' }
    if (!review?.ok) {
      if (trace) await this.observability.completeTrace(trace.id, { ok: false, metadata: { review: 'failed' } })
      return { status: SoftwareRunStatus.FAILED, task: completed, review, evaluation: null, traceId: trace?.id || null }
    }

    let evaluation = null
    if (evaluationScenario) {
      if (!this.evaluationEngine) throw new Error('evaluationEngine is required for evaluationScenario')
      evaluation = await this.evaluationEngine.runScenario(evaluationScenario, { spec: clone(spec), task: clone(completed), review: clone(review) })
      if (!evaluation.passed) {
        if (trace) await this.observability.completeTrace(trace.id, { ok: false, metadata: { evaluationId: evaluation.id } })
        return { status: SoftwareRunStatus.FAILED, task: completed, review, evaluation, traceId: trace?.id || null }
      }
    }

    if (trace) {
      await this.observability.emit(trace.id, 'SOFTWARE_VERIFIED', { taskId: completed.id, evaluationId: evaluation?.id || null })
      await this.observability.completeTrace(trace.id, { ok: true })
    }
    return { status: SoftwareRunStatus.SUCCEEDED, task: completed, review, evaluation, traceId: trace?.id || null }
  }
}
