import { RuntimeTaskStatus, RuntimeStepStatus } from './contracts.js'
import { OperationSource, createOperationEnvelope } from '../../reliability/operation-envelope.js'

const TERMINAL = new Set([RuntimeTaskStatus.SUCCEEDED, RuntimeTaskStatus.FAILED, RuntimeTaskStatus.CANCELLED])
const ACTIVE_STEP = new Set([RuntimeStepStatus.PENDING, RuntimeStepStatus.RUNNING, RuntimeStepStatus.VERIFYING, RuntimeStepStatus.BLOCKED])

const clone = (value) => structuredClone(value)

export const OperationalSourceType = Object.freeze({
  ISSUE: 'issue',
})

export function extractRoomNumber(value) {
  const match = String(value || '').match(/(?:Camera\s*·?\s*)?(\d{3,4})\b/i)
  return match?.[1] || null
}

// Hotel Giò invariant: Jazz uses four-digit room numbers (e.g. 1101, 1114),
// Wine uses three-digit room numbers (e.g. 201, 214).
export function classifyGioRoomSection(value) {
  const room = extractRoomNumber(value)
  if (!room) return null
  if (/^\d{4}$/.test(room)) return 'Jazz'
  if (/^\d{3}$/.test(room)) return 'Wine'
  return null
}

function issueObjective(issue) {
  const location = String(issue?.room || issue?.location || '').trim()
  const problem = String(issue?.title || issue?.description || '').trim()
  return [location && `Intervento ${location}`, problem].filter(Boolean).join(': ') || `Gestire segnalazione ${issue?.id || ''}`.trim()
}

function nextRunnableStep(task) {
  const steps = task?.plan?.steps || []
  for (const step of steps) {
    const state = task?.steps?.[step.id]
    if (!state || !ACTIVE_STEP.has(state.status)) continue
    const depsReady = (step.dependsOn || []).every((id) => task?.steps?.[id]?.status === RuntimeStepStatus.SUCCEEDED)
    if (depsReady || state.status !== RuntimeStepStatus.PENDING) return { step, state }
  }
  return null
}

export function summarizeOperationalTask(task) {
  if (!task) return null
  const planSteps = task.plan?.steps || []
  const succeeded = planSteps.filter((step) => task.steps?.[step.id]?.status === RuntimeStepStatus.SUCCEEDED).length
  const current = nextRunnableStep(task)
  const blockedError = [...(task.errors || [])].reverse().find((item) => item?.stepId === current?.step?.id || item?.code)
  return {
    id: task.id,
    operationId: task.metadata?.operation?.operationId || null,
    sourceType: task.metadata?.sourceType || null,
    sourceId: task.metadata?.sourceId || null,
    hotelId: task.metadata?.hotelId || null,
    room: task.metadata?.room || null,
    section: task.metadata?.section || null,
    status: task.status,
    completedSteps: succeeded,
    totalSteps: planSteps.length,
    nextStepId: current?.step?.id || null,
    nextStepTitle: current?.step?.title || null,
    nextStepStatus: current?.state?.status || null,
    blockedReason: task.status === RuntimeTaskStatus.BLOCKED
      ? (task.checkpoint?.reason || blockedError?.reason || blockedError?.code || 'blocked')
      : null,
    checkpoint: task.checkpoint ? clone(task.checkpoint) : null,
    updatedAt: task.updatedAt || null,
    completedAt: task.completedAt || null,
  }
}

export class OperationalTaskCoordinator {
  constructor({ runner, store, supervisor = null } = {}) {
    if (!runner || !store) throw new TypeError('runner and store are required')
    this.runner = runner
    this.store = store
    this.supervisor = supervisor
  }

  async findIssueTask({ hotelId, issueId } = {}) {
    if (!hotelId || !issueId) throw new TypeError('hotelId and issueId are required')
    if (this.store.findActiveBySource) {
      return this.store.findActiveBySource({ hotelId, sourceType: OperationalSourceType.ISSUE, sourceId: String(issueId) })
    }
    const tasks = await this.store.list?.() || []
    return tasks.find((task) => !TERMINAL.has(task.status)
      && task.metadata?.hotelId === hotelId
      && task.metadata?.sourceType === OperationalSourceType.ISSUE
      && String(task.metadata?.sourceId) === String(issueId)) || null
  }

  async createOrReuseIssueTask({ hotelId, issue, context = {}, proposedPlan, objective = null } = {}) {
    if (!hotelId || !issue?.id) throw new TypeError('hotelId and issue.id are required')
    const existing = await this.findIssueTask({ hotelId, issueId: issue.id })
    if (existing) return { task: existing, reused: true }

    const room = extractRoomNumber(issue.room || issue.location)
    const operation = createOperationEnvelope({
      hotelId,
      userId: context.userId,
      role: context.role,
      correlationId: context.correlationId,
      traceId: context.traceId,
      module: 'issues',
      action: 'randai_task_create',
      recordType: 'issue',
      recordId: String(issue.id),
      source: OperationSource.RANDAI,
      metadata: { room },
    })
    const task = await this.runner.create({
      objective: objective || issueObjective(issue),
      proposedPlan,
      context: { ...context, operationId: operation.operationId },
      metadata: {
        hotelId,
        operation,
        sourceType: OperationalSourceType.ISSUE,
        sourceId: String(issue.id),
        room,
        section: hotelId === 'hotelgio' ? classifyGioRoomSection(room) : null,
        issueStatus: issue.status || null,
        issueUrgency: issue.urgency || null,
        issueCategory: issue.category || null,
      },
    })
    return { task, reused: false }
  }

  async advanceIssueTask({ hotelId, issueId, pauseAfterSteps = Infinity, supervisorContext = {} } = {}) {
    const task = await this.findIssueTask({ hotelId, issueId })
    if (!task) throw new Error(`No active RandAI task for issue ${issueId}`)

    if (!this.supervisor) {
      const advanced = await this.runner.resume(task.id, { hotelId, pauseAfterSteps })
      return { task: advanced, supervisorRun: null, summary: summarizeOperationalTask(advanced) }
    }

    const supervisorRun = await this.supervisor.run({
      objective: task.objective,
      projectId: 'randapp-maintenance',
      taskId: task.id,
      complexity: task.plan?.steps?.length > 3 ? 'HIGH' : 'LOW',
      context: { ...clone(supervisorContext), taskId: task.id, operationId: task.metadata?.operation?.operationId || null, sourceType: OperationalSourceType.ISSUE, sourceId: String(issueId), hotelId },
      executeSingle: async () => {
        const advanced = await this.runner.resume(task.id, { hotelId, pauseAfterSteps })
        return {
          ok: advanced.status !== RuntimeTaskStatus.FAILED && advanced.status !== RuntimeTaskStatus.CANCELLED,
          taskId: advanced.id,
          taskStatus: advanced.status,
          checkpoint: advanced.checkpoint,
          qualityScore: advanced.status === RuntimeTaskStatus.SUCCEEDED ? 1 : 0.9,
          metrics: { agents: 1 },
        }
      },
    })
    const advanced = await this.store.load(task.id)
    return { task: advanced, supervisorRun, summary: summarizeOperationalTask(advanced) }
  }

  async cancelIssueTask({ hotelId, issueId, reason = 'cancelled_by_user' } = {}) {
    const task = await this.findIssueTask({ hotelId, issueId })
    if (!task) throw new Error(`No active RandAI task for issue ${issueId}`)
    const cancelled = await this.runner.cancel(task.id, { hotelId, reason })
    return { task: cancelled, summary: summarizeOperationalTask(cancelled) }
  }

  async getIssueTaskSummary({ hotelId, issueId } = {}) {
    return summarizeOperationalTask(await this.findIssueTask({ hotelId, issueId }))
  }
}
