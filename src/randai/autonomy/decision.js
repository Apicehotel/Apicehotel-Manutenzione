import { ToolPermission, ToolRisk } from '../tools/contracts.js'
import { AutonomyDecision, AutonomyLevel, AUTONOMY_LEVEL_ORDER } from './contracts.js'

export const AutonomyDisposition = Object.freeze({
  AUTO: 'AUTO',
  CONFIRM: 'CONFIRM',
  BLOCK: 'BLOCK',
})

const BLOCKED_EVALUATIONS = new Set([
  AutonomyDecision.DENY,
  AutonomyDecision.OBSERVE_ONLY,
])
const CONFIRM_EVALUATIONS = new Set([
  AutonomyDecision.REQUIRE_APPROVAL,
  AutonomyDecision.PREPARE_ONLY,
])

function levelIndex(level) {
  const index = AUTONOMY_LEVEL_ORDER.indexOf(level)
  return index < 0 ? -1 : index
}

function result(disposition, reason, extra = {}) {
  return Object.freeze({ disposition, allowed: disposition === AutonomyDisposition.AUTO, reason, ...extra })
}

/**
 * Resolves the final operational disposition.
 *
 * This is a client/planning guard only: the server Action Gateway and RLS
 * remain the final authority for every mutation.
 */
export function resolveAutonomyDecision({
  evaluation,
  confidenceDecision,
  planValidation = { ok: true },
  permissionGranted = false,
  humanConfirmed = false,
  contextValid = true,
  requestedLevel = null,
  policyLevel = null,
} = {}) {
  if (!evaluation || !Object.values(AutonomyDecision).includes(evaluation.decision)) {
    return result(AutonomyDisposition.BLOCK, 'AUTONOMY_EVALUATION_MISSING')
  }
  if (!planValidation?.ok) return result(AutonomyDisposition.BLOCK, 'PLAN_INVALID')
  if (!contextValid) return result(AutonomyDisposition.BLOCK, 'CONTEXT_SCOPE_INVALID')
  if (!permissionGranted) return result(AutonomyDisposition.BLOCK, 'PERMISSION_DENIED')

  if (requestedLevel && (!policyLevel || levelIndex(requestedLevel) > levelIndex(policyLevel))) {
    return result(AutonomyDisposition.BLOCK, 'AUTONOMY_ESCALATION_DENIED')
  }

  const confidence = confidenceDecision?.disposition || confidenceDecision?.decision
  if (!confidence) return result(AutonomyDisposition.BLOCK, 'CONFIDENCE_DECISION_MISSING')
  if (confidence === 'BLOCK') return result(AutonomyDisposition.BLOCK, 'RISK_BLOCK')
  if (!['AUTO', 'REVIEW'].includes(confidence)) return result(AutonomyDisposition.BLOCK, 'CONFIDENCE_DECISION_INVALID')

  const tool = evaluation.tool || {}
  if (tool.risk === ToolRisk.CRITICAL) return result(AutonomyDisposition.BLOCK, 'CRITICAL_ACTION_BLOCKED')
  if (BLOCKED_EVALUATIONS.has(evaluation.decision)) return result(AutonomyDisposition.BLOCK, evaluation.reason || 'AUTONOMY_BLOCKED')

  const needsConfirmation = CONFIRM_EVALUATIONS.has(evaluation.decision)
    || confidence === 'REVIEW'
    || tool.permission === ToolPermission.ADMIN
    || tool.permission === ToolPermission.WRITE_PROTECTED
    || tool.risk === ToolRisk.HIGH

  if (needsConfirmation && !humanConfirmed) {
    return result(AutonomyDisposition.CONFIRM, 'HUMAN_CONFIRMATION_REQUIRED', { confirmationRequired: true })
  }
  if (needsConfirmation && humanConfirmed) {
    return result(AutonomyDisposition.AUTO, 'HUMAN_CONFIRMATION_PRESENT', { confirmationRequired: true })
  }
  return result(AutonomyDisposition.AUTO, evaluation.reason || 'AUTONOMY_ALLOWED')
}

export function assertAutonomyMayExecute(input) {
  const decision = resolveAutonomyDecision(input)
  if (decision.disposition !== AutonomyDisposition.AUTO) {
    const error = new Error(decision.reason)
    error.code = decision.disposition === AutonomyDisposition.CONFIRM
      ? 'ACTION_REQUIRES_CONFIRMATION'
      : 'ACTION_BLOCKED'
    error.policy = decision
    throw error
  }
  return decision
}
