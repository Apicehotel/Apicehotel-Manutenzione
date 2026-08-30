export const SuggestionKind = Object.freeze({ PROCEDURE: 'PROCEDURE', KNOWLEDGE: 'KNOWLEDGE', MEMORY: 'MEMORY', AI_SUGGESTION: 'AI_SUGGESTION', UNKNOWN: 'UNKNOWN', ESCALATION: 'ESCALATION' })
export const GuidanceTrust = Object.freeze({ APPROVED: 'APPROVED', VERIFIED: 'VERIFIED', AI_SUGGESTION: 'AI_SUGGESTION', UNKNOWN: 'UNKNOWN' })
export const GuidanceSessionStatus = Object.freeze({ ACTIVE: 'ACTIVE', BLOCKED: 'BLOCKED', ESCALATED: 'ESCALATED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' })
export const GuidanceStepStatus = Object.freeze({ PENDING: 'PENDING', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', BLOCKED: 'BLOCKED', SKIPPED: 'SKIPPED' })
export const StepAction = Object.freeze({ DONE: 'DONE', FOUND: 'FOUND', NOT_FOUND: 'NOT_FOUND', CANNOT_VERIFY: 'CANNOT_VERIFY', ESCALATE: 'ESCALATE' })

export const ROLE_RANK = Object.freeze({ staff: 1, manutentore: 2, responsabile: 3, tecnico_esterno: 4 })

export function assertGuidedProcedure(procedure) {
  if (!procedure?.id || !procedure?.hotelId || !procedure?.title) throw new TypeError('Guided procedure requires id, hotelId and title')
  if (!Array.isArray(procedure.steps) || !procedure.steps.length) throw new TypeError('Guided procedure requires steps')
  const ids = new Set()
  for (const step of procedure.steps) {
    if (!step?.id || !step?.instruction) throw new TypeError('Each guidance step requires id and instruction')
    if (ids.has(step.id)) throw new TypeError(`Duplicate guidance step: ${step.id}`)
    ids.add(step.id)
  }
  for (const step of procedure.steps) {
    for (const target of Object.values(step.transitions || {})) {
      if (target && target !== 'COMPLETE' && target !== 'ESCALATE' && !ids.has(target)) throw new TypeError(`Unknown guidance transition target: ${target}`)
    }
  }
  return procedure
}
