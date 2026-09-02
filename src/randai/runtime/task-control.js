import { CheckpointKind, RuntimeStepStatus, RuntimeTaskStatus } from './contracts.js'

const TERMINAL = new Set([RuntimeTaskStatus.SUCCEEDED, RuntimeTaskStatus.FAILED, RuntimeTaskStatus.CANCELLED])
const UNCERTAIN_EFFECT = new Set([RuntimeStepStatus.RUNNING, RuntimeStepStatus.VERIFYING])
const nowIso = () => new Date().toISOString()
const makeOwner = () => `cancel-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

function leaseConflict(taskId) {
  const error = new Error(`Task ${taskId} is already leased by another runner`)
  error.code = 'TASK_LEASE_CONFLICT'
  return error
}

export async function cancelDurableTask({ store, taskId, reason = 'cancelled_by_user', cancelledBy = null, leaseSeconds = 120 } = {}) {
  if (!store?.load || !store?.save) throw new TypeError('store with load/save is required')
  if (!taskId) throw new TypeError('taskId is required')

  const owner = makeOwner()
  const lease = store.claim ? await store.claim(taskId, { owner, leaseSeconds }) : { token: null }
  if (!lease) throw leaseConflict(taskId)

  try {
    const task = await store.load(taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (TERMINAL.has(task.status)) return task

    const uncertain = Object.values(task.steps || {}).filter((step) => UNCERTAIN_EFFECT.has(step?.status))
    if (uncertain.length) {
      const error = new Error(`Task ${taskId} has an in-flight effect and requires reconciliation before cancellation`)
      error.code = 'CANCEL_REQUIRES_RECONCILIATION'
      throw error
    }

    const at = nowIso()
    task.status = RuntimeTaskStatus.CANCELLED
    task.completedAt = at
    task.updatedAt = at
    task.decisions ||= []
    task.events ||= []
    task.decisions.push({ at, type: 'TASK_CANCELLED', reason, cancelledBy })
    task.checkpoint = { kind: CheckpointKind.CANCELLED, at, reason, cancelledBy }
    task.events.push({ type: 'CHECKPOINT', ...task.checkpoint })
    await store.save(task)
    return task
  } finally {
    if (lease.token && store.release) await store.release(taskId, lease.token).catch(() => false)
  }
}
