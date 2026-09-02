export const GuidanceStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
})

export const StepResult = Object.freeze({
  DONE: 'DONE',
  FOUND: 'FOUND',
  NOT_FOUND: 'NOT_FOUND',
  CANNOT_VERIFY: 'CANNOT_VERIFY',
  ESCALATE: 'ESCALATE',
})

const VALID_NEXT_KEYS = new Set([...Object.values(StepResult), 'default'])

export function validateGuidedProcedure(procedure) {
  if (!procedure?.id || !procedure?.hotelId || !procedure?.title) throw new TypeError('Guided procedure requires id, hotelId and title')
  if (!Array.isArray(procedure.steps) || procedure.steps.length === 0) throw new TypeError('Guided procedure requires steps')
  const ids = new Set()
  const byId = new Map()
  for (const step of procedure.steps) {
    if (!step?.id || !step?.title) throw new TypeError('Each guided step requires id and title')
    if (ids.has(step.id)) throw new TypeError(`Duplicate guided step id: ${step.id}`)
    ids.add(step.id)
    byId.set(step.id, step)
    if (step.next != null && (typeof step.next !== 'object' || Array.isArray(step.next))) throw new TypeError(`Guided step next must be an object: ${step.id}`)
    for (const key of Object.keys(step.next || {})) {
      if (!VALID_NEXT_KEYS.has(key)) throw new TypeError(`Unknown guided result branch ${key} on step ${step.id}`)
    }
    for (const result of step.stopOn || []) {
      if (!Object.values(StepResult).includes(result)) throw new TypeError(`Unknown stopOn result ${result} on step ${step.id}`)
    }
  }
  for (const step of procedure.steps) {
    for (const nextId of Object.values(step.next || {})) {
      if (nextId && !ids.has(nextId)) throw new TypeError(`Unknown guided next step: ${nextId}`)
    }
  }

  const reachable = new Set()
  const queue = [procedure.steps[0].id]
  while (queue.length) {
    const id = queue.shift()
    if (reachable.has(id)) continue
    reachable.add(id)
    const step = byId.get(id)
    for (const nextId of Object.values(step?.next || {})) if (nextId && !reachable.has(nextId)) queue.push(nextId)
  }
  const unreachable = procedure.steps.filter((step) => !reachable.has(step.id)).map((step) => step.id)
  if (unreachable.length) throw new TypeError(`Unreachable guided steps: ${unreachable.join(', ')}`)

  const terminal = procedure.steps.some((step) => reachable.has(step.id) && Object.values(step.next || {}).filter(Boolean).length === 0)
  if (!terminal) throw new TypeError('Guided procedure requires at least one reachable terminal step')
  return true
}
