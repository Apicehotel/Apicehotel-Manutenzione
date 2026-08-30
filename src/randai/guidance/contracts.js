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

export function validateGuidedProcedure(procedure) {
  if (!procedure?.id || !procedure?.hotelId || !procedure?.title) throw new TypeError('Guided procedure requires id, hotelId and title')
  if (!Array.isArray(procedure.steps) || procedure.steps.length === 0) throw new TypeError('Guided procedure requires steps')
  const ids = new Set()
  for (const step of procedure.steps) {
    if (!step?.id || !step?.title) throw new TypeError('Each guided step requires id and title')
    if (ids.has(step.id)) throw new TypeError(`Duplicate guided step id: ${step.id}`)
    ids.add(step.id)
  }
  for (const step of procedure.steps) {
    for (const nextId of Object.values(step.next || {})) {
      if (nextId && !ids.has(nextId)) throw new TypeError(`Unknown guided next step: ${nextId}`)
    }
  }
  return true
}
