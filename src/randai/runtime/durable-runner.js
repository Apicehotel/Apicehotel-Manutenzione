import { RuntimeTaskStatus, RuntimeStepStatus, CheckpointKind } from './contracts.js'
import { AutonomyDecision } from '../autonomy/contracts.js'
import { RecoveryAction } from '../recovery/contracts.js'

let runtimeSequence = 0
const nowIso = () => new Date().toISOString()
const nextId = () => globalThis.crypto?.randomUUID
  ? `RND-RUN-${globalThis.crypto.randomUUID()}`
  : `RND-RUN-${Date.now()}-${String(++runtimeSequence).padStart(6, '0')}`
const runnerId = () => globalThis.crypto?.randomUUID?.() || `runner-${Date.now()}-${Math.random().toString(36).slice(2)}`
const TERMINAL_TASK_STATUSES = new Set([RuntimeTaskStatus.SUCCEEDED, RuntimeTaskStatus.FAILED, RuntimeTaskStatus.CANCELLED])

function stepState(step) {
  return { id: step.id, status: RuntimeStepStatus.PENDING, attempts: 0, strategyIndex: 0, result: null, verification: null, startedAt: null, completedAt: null }
}
function leaseConflict(taskId) { const error = new Error(`Task ${taskId} is already leased by another runner`); error.code = 'TASK_LEASE_CONFLICT'; error.taskId = taskId; return error }

export class DurableTaskRunner {
  constructor({ planner, registry, verifier, store, logger, autonomyEngine = null, recoveryEngine = null, leaseSeconds = 120 } = {}) {
    if (!planner || !registry || !verifier || !store) throw new TypeError('planner, registry, verifier and store are required')
    this.planner = planner; this.registry = registry; this.verifier = verifier; this.store = store; this.logger = logger
    this.autonomyEngine = autonomyEngine; this.recoveryEngine = recoveryEngine
    this.activeResumes = new Map(); this.activeLeases = new Map(); this.runnerId = runnerId(); this.leaseSeconds = Math.max(30, Number(leaseSeconds || 120))
  }

  async create({ objective, proposedPlan, metadata = {}, context = {} }) {
    const plan = await this.planner.plan({ objective, proposedPlan, context })
    const task = {
      id: nextId(), objective, metadata, plan, status: RuntimeTaskStatus.PENDING,
      steps: Object.fromEntries(plan.steps.map((s) => [s.id, stepState(s)])),
      decisions: [], errors: [], artifacts: [], events: [], recoveryHistory: [], checkpoint: null,
      createdAt: nowIso(), updatedAt: nowIso(), completedAt: null,
    }
    this.#checkpoint(task, CheckpointKind.PLAN_READY)
    await this.store.save(task)
    return task
  }

  async resume(taskId, options = {}) {
    const active = this.activeResumes.get(taskId)
    if (active) return active
    const execution = this.#resumeWithLease(taskId, options).finally(() => {
      if (this.activeResumes.get(taskId) === execution) this.activeResumes.delete(taskId)
    })
    this.activeResumes.set(taskId, execution)
    return execution
  }

  async #resumeWithLease(taskId, options) {
    const snapshot = await this.store.load(taskId)
    if (!snapshot) throw new Error(`Task ${taskId} not found`)
    if (TERMINAL_TASK_STATUSES.has(snapshot.status)) return snapshot
    const lease = this.store.claim ? await this.store.claim(taskId, { owner: this.runnerId, leaseSeconds: this.leaseSeconds }) : { token: null }
    if (!lease) throw leaseConflict(taskId)
    this.activeLeases.set(taskId, lease)
    try { return await this.#resumeUnlocked(taskId, options) }
    finally {
      this.activeLeases.delete(taskId)
      if (lease.token && this.store.release) await this.store.release(taskId, lease.token).catch(() => false)
    }
  }

  async #renewLease(taskId) {
    const lease = this.activeLeases.get(taskId)
    if (!lease?.token || !this.store.renew) return
    const renewed = await this.store.renew(taskId, lease.token, { leaseSeconds: this.leaseSeconds })
    if (!renewed) throw leaseConflict(taskId)
    this.activeLeases.set(taskId, { ...lease, ...renewed })
  }

  async #resumeUnlocked(taskId, { pauseAfterSteps = Infinity } = {}) {
    const task = await this.store.load(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (TERMINAL_TASK_STATUSES.has(task.status)) return task

    const awaitingReconciliation = task.errors?.find((error) => error.code === 'INTERRUPTED_STEP_REQUIRES_RECONCILIATION' && task.steps?.[error.stepId]?.status === RuntimeStepStatus.BLOCKED)
    if (awaitingReconciliation) { task.status = RuntimeTaskStatus.BLOCKED; return task }

    const interrupted = task.plan.steps.find((step) => [RuntimeStepStatus.RUNNING, RuntimeStepStatus.VERIFYING].includes(task.steps[step.id]?.status))
    if (interrupted) {
      const state = task.steps[interrupted.id]; const previousStatus = state.status
      state.status = RuntimeStepStatus.BLOCKED; task.status = RuntimeTaskStatus.BLOCKED
      task.errors.push({ at: nowIso(), code: 'INTERRUPTED_STEP_REQUIRES_RECONCILIATION', stepId: interrupted.id, previousStatus })
      this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: interrupted.id, reason: 'INTERRUPTED_STEP_REQUIRES_RECONCILIATION' })
      await this.store.save(task); return task
    }

    task.status = RuntimeTaskStatus.RUNNING
    let completedThisRun = 0
    while (true) {
      const pending = task.plan.steps.filter((s) => [RuntimeStepStatus.PENDING, RuntimeStepStatus.BLOCKED].includes(task.steps[s.id].status))
      if (!pending.length) break
      for (const step of pending) if (task.steps[step.id].status === RuntimeStepStatus.BLOCKED) task.steps[step.id].status = RuntimeStepStatus.PENDING
      const ready = pending.filter((s) => (s.dependsOn || []).every((id) => task.steps[id]?.status === RuntimeStepStatus.SUCCEEDED))
      if (!ready.length) { task.status = RuntimeTaskStatus.BLOCKED; task.errors.push({ at: nowIso(), code: 'DEPENDENCY_BLOCKED', message: 'No runnable steps remain' }); await this.store.save(task); return task }
      for (const step of ready) {
        const outcome = await this.#runStep(task, step)
        await this.store.save(task)
        if (!outcome.ok) { task.status = outcome.blocked ? RuntimeTaskStatus.BLOCKED : RuntimeTaskStatus.FAILED; if (!outcome.blocked) task.completedAt = nowIso(); await this.store.save(task); return task }
        completedThisRun += 1
        if (completedThisRun >= pauseAfterSteps) { task.status = RuntimeTaskStatus.PAUSED; this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: step.id }); await this.store.save(task); return task }
      }
    }
    task.status = RuntimeTaskStatus.VERIFYING
    const allOk = task.plan.steps.every((s) => task.steps[s.id].status === RuntimeStepStatus.SUCCEEDED)
    if (!allOk) { task.status = RuntimeTaskStatus.FAILED; this.#checkpoint(task, CheckpointKind.VERIFICATION_FAIL) }
    else { task.status = RuntimeTaskStatus.SUCCEEDED; task.completedAt = nowIso(); this.#checkpoint(task, CheckpointKind.COMPLETED) }
    await this.store.save(task); return task
  }

  async reconcileInterrupted(taskId, stepId, { resolution, result = null, verification = null } = {}) {
    const lease = this.store.claim ? await this.store.claim(taskId, { owner: this.runnerId, leaseSeconds: this.leaseSeconds }) : { token: null }
    if (!lease) throw leaseConflict(taskId)
    try {
      const task = await this.store.load(taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)
      const state = task.steps?.[stepId]
      if (!state) throw new Error(`Step ${stepId} not found`)
      const interrupted = task.errors?.some((error) => error.code === 'INTERRUPTED_STEP_REQUIRES_RECONCILIATION' && error.stepId === stepId)
      if (!interrupted || state.status !== RuntimeStepStatus.BLOCKED) throw new Error('Step is not awaiting interruption reconciliation')
      if (!['SUCCEEDED', 'RETRY', 'FAILED'].includes(resolution)) throw new TypeError('resolution must be SUCCEEDED, RETRY or FAILED')
      state.result = result ?? state.result; state.verification = verification ?? state.verification
      if (resolution === 'SUCCEEDED') { state.status = RuntimeStepStatus.SUCCEEDED; state.completedAt = nowIso(); task.status = RuntimeTaskStatus.PAUSED; this.#checkpoint(task, CheckpointKind.STEP_COMPLETE, { stepId, reconciled: true }) }
      else if (resolution === 'RETRY') { state.status = RuntimeStepStatus.PENDING; state.completedAt = null; task.status = RuntimeTaskStatus.PAUSED; task.decisions.push({ at: nowIso(), type: 'INTERRUPTED_STEP_RETRY_APPROVED', stepId }); this.#checkpoint(task, CheckpointKind.PAUSED, { stepId, reconciled: true, resolution }) }
      else { state.status = RuntimeStepStatus.FAILED; state.completedAt = nowIso(); task.status = RuntimeTaskStatus.FAILED; task.completedAt = nowIso(); this.#checkpoint(task, CheckpointKind.STEP_FAILED, { stepId, reconciled: true }) }
      await this.store.save(task); return task
    } finally { if (lease.token && this.store.release) await this.store.release(taskId, lease.token).catch(() => false) }
  }

  async #runStep(task, step) {
    const state = task.steps[step.id]; state.startedAt ||= nowIso(); const strategies = step.strategies || []
    while (state.strategyIndex < strategies.length) {
      const strategy = strategies[state.strategyIndex]
      const authorization = await this.#authorize(task, step, strategy)
      if (authorization && authorization.decision !== AutonomyDecision.ALLOW) { state.status = RuntimeStepStatus.BLOCKED; task.decisions.push({ at: nowIso(), type: 'AUTONOMY_BLOCK', stepId: step.id, toolId: strategy.toolId, decision: authorization.decision, reason: authorization.reason, approvalId: authorization.approval?.id || null }); this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: step.id, reason: authorization.reason, approvalId: authorization.approval?.id || null }); return { ok: false, blocked: true, authorization } }
      await this.#renewLease(task.id)
      state.status = RuntimeStepStatus.RUNNING; state.attempts += 1
      this.#checkpoint(task, CheckpointKind.STEP_STARTED, { stepId: step.id, strategyIndex: state.strategyIndex, toolId: strategy.toolId }); await this.store.save(task)
      let result
      const effectKey = `${task.id}:${step.id}:${state.strategyIndex}`
      try { result = await this.registry.execute(strategy.toolId, strategy.input || {}, { task, step, strategy, effectKey, idempotencyKey: effectKey }) }
      catch (error) { result = { status: 'FAILED', data: null, error: { code: error?.code || 'EXECUTION_ERROR', message: error?.message || String(error) } } }
      await this.#renewLease(task.id)
      state.result = result; state.status = RuntimeStepStatus.VERIFYING; await this.store.save(task)
      let verification
      try { verification = await this.verifier.verify({ task, step, result, strategy }) } catch (error) { verification = { ok: false, reason: error?.message || 'verifier_error' } }
      state.verification = verification
      if (verification.ok) { state.status = RuntimeStepStatus.SUCCEEDED; state.completedAt = nowIso(); this.#checkpoint(task, CheckpointKind.STEP_COMPLETE, { stepId: step.id, strategyIndex: state.strategyIndex }); return { ok: true } }
      task.errors.push({ at: nowIso(), stepId: step.id, strategyIndex: state.strategyIndex, resultStatus: result?.status, reason: verification.reason || 'verification_failed' })
      if (!this.recoveryEngine) { if (state.strategyIndex + 1 < strategies.length) { const previous = state.strategyIndex; state.strategyIndex += 1; task.decisions.push({ at: nowIso(), type: 'STRATEGY_CHANGE', stepId: step.id, from: previous, to: state.strategyIndex, reason: verification.reason || result?.error?.code || result?.status || 'failed' }); continue } return this.#failStep(task, step, state) }
      const recovery = this.recoveryEngine.decide({ task, step, state, strategy, result, verification }); this.recoveryEngine.record(task, recovery, { stepId: step.id, strategyIndex: state.strategyIndex, toolId: strategy.toolId })
      if (recovery.action === RecoveryAction.RETRY_SAME) continue
      if (recovery.action === RecoveryAction.SWITCH_STRATEGY) { state.strategyIndex += 1; continue }
      if (recovery.action === RecoveryAction.ASK_HUMAN) { state.status = RuntimeStepStatus.BLOCKED; this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: step.id, reason: recovery.reason, recoveryAction: recovery.action }); return { ok: false, blocked: true, recovery } }
      if (recovery.action === RecoveryAction.ROLLBACK) { const rolledBack = await this.#rollback(task, step, recovery.rollback); task.decisions.push({ at: nowIso(), type: 'ROLLBACK_RESULT', stepId: step.id, ok: rolledBack.ok, details: rolledBack }); if (rolledBack.blocked) { state.status = RuntimeStepStatus.BLOCKED; return { ok: false, blocked: true, recovery, rollback: rolledBack } } return this.#failStep(task, step, state, { rollback: rolledBack }) }
      return this.#failStep(task, step, state, { recovery })
    }
    return this.#failStep(task, step, state)
  }

  async #authorize(task, step, strategy) {
    if (!this.autonomyEngine) return null
    return this.autonomyEngine.authorize({ toolId: strategy.toolId, input: strategy.input || {}, taskId: task.id, stepId: step.id, hotelId: task.metadata?.hotelId || null, scope: task.metadata?.scope || null })
  }
  async #rollback(task, step, rollback) {
    if (!rollback?.toolId) return { ok: false, reason: 'INVALID_ROLLBACK' }
    const authorization = this.autonomyEngine ? await this.autonomyEngine.authorize({ toolId: rollback.toolId, input: rollback.input || {}, taskId: task.id, stepId: `${step.id}:rollback`, hotelId: task.metadata?.hotelId || null, scope: task.metadata?.scope || null }) : null
    if (authorization && authorization.decision !== AutonomyDecision.ALLOW) return { ok: false, blocked: true, authorization }
    await this.#renewLease(task.id)
    const effectKey = `${task.id}:${step.id}:rollback`
    const result = await this.registry.execute(rollback.toolId, rollback.input || {}, { task, step, rollback: true, effectKey, idempotencyKey: effectKey })
    return { ok: result?.status === 'SUCCESS', result }
  }
  #failStep(task, step, state, extra = {}) { state.status = RuntimeStepStatus.FAILED; state.completedAt = nowIso(); this.#checkpoint(task, CheckpointKind.STEP_FAILED, { stepId: step.id, ...extra }); return { ok: false, ...extra } }
  #checkpoint(task, kind, details = {}) { task.updatedAt = nowIso(); task.checkpoint = { kind, at: task.updatedAt, ...details }; task.events.push({ type: 'CHECKPOINT', ...task.checkpoint }); this.logger?.info?.('runtime.checkpoint', { taskId: task.id, ...task.checkpoint }) }
}
