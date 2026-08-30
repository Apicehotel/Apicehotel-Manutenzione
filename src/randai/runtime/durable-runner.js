import { RuntimeTaskStatus, RuntimeStepStatus, CheckpointKind } from './contracts.js'
import { AutonomyDecision } from '../autonomy/contracts.js'
import { RecoveryAction } from '../recovery/contracts.js'

let runtimeSequence = 0
const nowIso = () => new Date().toISOString()
const nextId = () => globalThis.crypto?.randomUUID
  ? `RND-RUN-${globalThis.crypto.randomUUID()}`
  : `RND-RUN-${Date.now()}-${String(++runtimeSequence).padStart(6, '0')}`

function stepState(step) {
  return { id: step.id, status: RuntimeStepStatus.PENDING, attempts: 0, strategyIndex: 0, result: null, verification: null, startedAt: null, completedAt: null }
}

export class DurableTaskRunner {
  constructor({ planner, registry, verifier, store, logger, autonomyEngine = null, recoveryEngine = null } = {}) {
    if (!planner || !registry || !verifier || !store) throw new TypeError('planner, registry, verifier and store are required')
    this.planner = planner; this.registry = registry; this.verifier = verifier; this.store = store; this.logger = logger
    this.autonomyEngine = autonomyEngine; this.recoveryEngine = recoveryEngine
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

  async resume(taskId, { pauseAfterSteps = Infinity } = {}) {
    const task = await this.store.load(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if ([RuntimeTaskStatus.SUCCEEDED, RuntimeTaskStatus.FAILED, RuntimeTaskStatus.CANCELLED].includes(task.status)) return task
    task.status = RuntimeTaskStatus.RUNNING
    let completedThisRun = 0

    while (true) {
      const pending = task.plan.steps.filter((s) => [RuntimeStepStatus.PENDING, RuntimeStepStatus.BLOCKED].includes(task.steps[s.id].status))
      if (!pending.length) break
      for (const step of pending) if (task.steps[step.id].status === RuntimeStepStatus.BLOCKED) task.steps[step.id].status = RuntimeStepStatus.PENDING
      const ready = pending.filter((s) => (s.dependsOn || []).every((id) => task.steps[id]?.status === RuntimeStepStatus.SUCCEEDED))
      if (!ready.length) {
        task.status = RuntimeTaskStatus.BLOCKED
        task.errors.push({ at: nowIso(), code: 'DEPENDENCY_BLOCKED', message: 'No runnable steps remain' })
        await this.store.save(task)
        return task
      }

      for (const step of ready) {
        const outcome = await this.#runStep(task, step)
        await this.store.save(task)
        if (!outcome.ok) {
          if (outcome.blocked) {
            task.status = RuntimeTaskStatus.BLOCKED
            await this.store.save(task)
            return task
          }
          task.status = RuntimeTaskStatus.FAILED
          task.completedAt = nowIso()
          await this.store.save(task)
          return task
        }
        completedThisRun += 1
        if (completedThisRun >= pauseAfterSteps) {
          task.status = RuntimeTaskStatus.PAUSED
          this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: step.id })
          await this.store.save(task)
          return task
        }
      }
    }

    task.status = RuntimeTaskStatus.VERIFYING
    const allOk = task.plan.steps.every((s) => task.steps[s.id].status === RuntimeStepStatus.SUCCEEDED)
    if (!allOk) {
      task.status = RuntimeTaskStatus.FAILED
      this.#checkpoint(task, CheckpointKind.VERIFICATION_FAIL)
    } else {
      task.status = RuntimeTaskStatus.SUCCEEDED
      task.completedAt = nowIso()
      this.#checkpoint(task, CheckpointKind.COMPLETED)
    }
    await this.store.save(task)
    return task
  }

  async #runStep(task, step) {
    const state = task.steps[step.id]
    state.status = RuntimeStepStatus.RUNNING
    state.startedAt ||= nowIso()
    const strategies = step.strategies || []

    while (state.strategyIndex < strategies.length) {
      const strategy = strategies[state.strategyIndex]
      const authorization = await this.#authorize(task, step, strategy)
      if (authorization && authorization.decision !== AutonomyDecision.ALLOW) {
        state.status = RuntimeStepStatus.BLOCKED
        task.decisions.push({ at: nowIso(), type: 'AUTONOMY_BLOCK', stepId: step.id, toolId: strategy.toolId, decision: authorization.decision, reason: authorization.reason, approvalId: authorization.approval?.id || null })
        this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: step.id, reason: authorization.reason, approvalId: authorization.approval?.id || null })
        return { ok: false, blocked: true, authorization }
      }

      state.attempts += 1
      let result
      try {
        result = await this.registry.execute(strategy.toolId, strategy.input || {}, { task, step, strategy })
      } catch (error) {
        result = { status: 'FAILED', data: null, error: { code: error?.code || 'EXECUTION_ERROR', message: error?.message || String(error) } }
      }
      state.result = result
      state.status = RuntimeStepStatus.VERIFYING
      let verification
      try {
        verification = await this.verifier.verify({ task, step, result, strategy })
      } catch (error) {
        verification = { ok: false, reason: error?.message || 'verifier_error' }
      }
      state.verification = verification

      if (verification.ok) {
        state.status = RuntimeStepStatus.SUCCEEDED
        state.completedAt = nowIso()
        this.#checkpoint(task, CheckpointKind.STEP_COMPLETE, { stepId: step.id, strategyIndex: state.strategyIndex })
        return { ok: true }
      }

      task.errors.push({ at: nowIso(), stepId: step.id, strategyIndex: state.strategyIndex, resultStatus: result?.status, reason: verification.reason || 'verification_failed' })
      if (!this.recoveryEngine) {
        if (state.strategyIndex + 1 < strategies.length) {
          const previous = state.strategyIndex
          state.strategyIndex += 1
          task.decisions.push({ at: nowIso(), type: 'STRATEGY_CHANGE', stepId: step.id, from: previous, to: state.strategyIndex, reason: verification.reason || result?.error?.code || result?.status || 'failed' })
          continue
        }
        return this.#failStep(task, step, state)
      }

      const recovery = this.recoveryEngine.decide({ task, step, state, strategy, result, verification })
      this.recoveryEngine.record(task, recovery, { stepId: step.id, strategyIndex: state.strategyIndex, toolId: strategy.toolId })
      if (recovery.action === RecoveryAction.RETRY_SAME) continue
      if (recovery.action === RecoveryAction.SWITCH_STRATEGY) { state.strategyIndex += 1; continue }
      if (recovery.action === RecoveryAction.ASK_HUMAN) {
        state.status = RuntimeStepStatus.BLOCKED
        this.#checkpoint(task, CheckpointKind.PAUSED, { stepId: step.id, reason: recovery.reason, recoveryAction: recovery.action })
        return { ok: false, blocked: true, recovery }
      }
      if (recovery.action === RecoveryAction.ROLLBACK) {
        const rolledBack = await this.#rollback(task, step, recovery.rollback)
        task.decisions.push({ at: nowIso(), type: 'ROLLBACK_RESULT', stepId: step.id, ok: rolledBack.ok, details: rolledBack })
        if (rolledBack.blocked) {
          state.status = RuntimeStepStatus.BLOCKED
          return { ok: false, blocked: true, recovery, rollback: rolledBack }
        }
        return this.#failStep(task, step, state, { rollback: rolledBack })
      }
      return this.#failStep(task, step, state, { recovery })
    }
    return this.#failStep(task, step, state)
  }

  async #authorize(task, step, strategy) {
    if (!this.autonomyEngine) return null
    return this.autonomyEngine.authorize({ toolId: strategy.toolId, input: strategy.input || {}, taskId: task.id, stepId: step.id })
  }

  async #rollback(task, step, rollback) {
    if (!rollback?.toolId) return { ok: false, reason: 'INVALID_ROLLBACK' }
    const authorization = this.autonomyEngine ? await this.autonomyEngine.authorize({ toolId: rollback.toolId, input: rollback.input || {}, taskId: task.id, stepId: `${step.id}:rollback` }) : null
    if (authorization && authorization.decision !== AutonomyDecision.ALLOW) return { ok: false, blocked: true, authorization }
    const result = await this.registry.execute(rollback.toolId, rollback.input || {}, { task, step, rollback: true })
    return { ok: result?.status === 'SUCCESS', result }
  }

  #failStep(task, step, state, extra = {}) {
    state.status = RuntimeStepStatus.FAILED
    state.completedAt = nowIso()
    this.#checkpoint(task, CheckpointKind.STEP_FAILED, { stepId: step.id, ...extra })
    return { ok: false, ...extra }
  }

  #checkpoint(task, kind, details = {}) {
    task.updatedAt = nowIso()
    task.checkpoint = { kind, at: task.updatedAt, ...details }
    task.events.push({ type: 'CHECKPOINT', ...task.checkpoint })
    this.logger?.info?.('runtime.checkpoint', { taskId: task.id, ...task.checkpoint })
  }
}
