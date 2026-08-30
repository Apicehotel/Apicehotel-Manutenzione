import { RuntimeTaskStatus, RuntimeStepStatus, CheckpointKind } from './contracts.js'

let runtimeSequence = 0
const nowIso = () => new Date().toISOString()
const nextId = () => `RND-RUN-${String(++runtimeSequence).padStart(6, '0')}`

function stepState(step) {
  return { id: step.id, status: RuntimeStepStatus.PENDING, attempts: 0, strategyIndex: 0, result: null, verification: null, startedAt: null, completedAt: null }
}

export class DurableTaskRunner {
  constructor({ planner, registry, verifier, store, logger } = {}) {
    if (!planner || !registry || !verifier || !store) throw new TypeError('planner, registry, verifier and store are required')
    this.planner = planner; this.registry = registry; this.verifier = verifier; this.store = store; this.logger = logger
  }

  async create({ objective, proposedPlan, metadata = {}, context = {} }) {
    const plan = await this.planner.plan({ objective, proposedPlan, context })
    const task = {
      id: nextId(), objective, metadata, plan, status: RuntimeTaskStatus.PENDING,
      steps: Object.fromEntries(plan.steps.map((s) => [s.id, stepState(s)])),
      decisions: [], errors: [], artifacts: [], events: [], checkpoint: null,
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
      const pending = task.plan.steps.filter((s) => task.steps[s.id].status === RuntimeStepStatus.PENDING)
      if (!pending.length) break
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
      state.attempts += 1
      const result = await this.registry.execute(strategy.toolId, strategy.input || {}, { task, step, strategy })
      state.result = result
      state.status = RuntimeStepStatus.VERIFYING
      const verification = await this.verifier.verify({ task, step, result, strategy })
      state.verification = verification

      if (verification.ok) {
        state.status = RuntimeStepStatus.SUCCEEDED
        state.completedAt = nowIso()
        this.#checkpoint(task, CheckpointKind.STEP_COMPLETE, { stepId: step.id, strategyIndex: state.strategyIndex })
        return { ok: true }
      }

      task.errors.push({ at: nowIso(), stepId: step.id, strategyIndex: state.strategyIndex, resultStatus: result?.status, reason: verification.reason || 'verification_failed' })
      if (state.strategyIndex + 1 < strategies.length) {
        const previous = state.strategyIndex
        state.strategyIndex += 1
        task.decisions.push({ at: nowIso(), type: 'STRATEGY_CHANGE', stepId: step.id, from: previous, to: state.strategyIndex, reason: verification.reason || result?.status || 'failed' })
        continue
      }
      state.status = RuntimeStepStatus.FAILED
      state.completedAt = nowIso()
      this.#checkpoint(task, CheckpointKind.STEP_FAILED, { stepId: step.id })
      return { ok: false }
    }
    return { ok: false }
  }

  #checkpoint(task, kind, details = {}) {
    task.updatedAt = nowIso()
    task.checkpoint = { kind, at: task.updatedAt, ...details }
    task.events.push({ type: 'CHECKPOINT', ...task.checkpoint })
    this.logger?.info?.('runtime.checkpoint', { taskId: task.id, ...task.checkpoint })
  }
}
