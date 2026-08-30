const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])
let sequence = 0

function nextTaskId(now = new Date()) {
  sequence = (sequence + 1) % 1000000
  const day = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `RND-${day}-${String(sequence).padStart(6, '0')}`
}

export function createTask({ objective, metadata = {}, now = new Date() }) {
  if (!objective || !String(objective).trim()) throw new TypeError('Task objective is required')
  return {
    id: nextTaskId(now),
    objective: String(objective).trim(),
    status: 'PENDING',
    createdAt: now.toISOString(),
    startedAt: null,
    completedAt: null,
    metadata: { ...metadata },
    events: [],
  }
}

export function transitionTask(task, status, details = {}, now = new Date()) {
  if (!task) throw new TypeError('Task is required')
  if (TERMINAL.has(task.status)) throw new Error(`Task ${task.id} is already terminal`)
  const allowed = {
    PENDING: new Set(['RUNNING', 'CANCELLED']),
    RUNNING: new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']),
  }
  if (!allowed[task.status]?.has(status)) throw new Error(`Invalid task transition ${task.status} -> ${status}`)
  task.status = status
  if (status === 'RUNNING' && !task.startedAt) task.startedAt = now.toISOString()
  if (TERMINAL.has(status)) task.completedAt = now.toISOString()
  task.events.push({ status, at: now.toISOString(), ...details })
  return task
}
