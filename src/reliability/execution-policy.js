const ORDER = Object.freeze({ AUTO: 0, REVIEW: 1, BLOCK: 2 })

export function decideExecutionPolicy({ hotelId, planValidation, confidenceDecision, permissionGranted = false, approvalPresent = false } = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  if (!planValidation?.ok) return { decision: 'BLOCK', reason: 'PLAN_INVALID' }
  if (!permissionGranted) return { decision: 'BLOCK', reason: 'PERMISSION_DENIED' }
  const decision = confidenceDecision?.decision
  if (!ORDER.hasOwnProperty(decision)) return { decision: 'BLOCK', reason: 'CONFIDENCE_DECISION_MISSING' }
  if (decision === 'BLOCK') return { decision: 'BLOCK', reason: confidenceDecision.reason || 'RISK_BLOCK' }
  if (decision === 'REVIEW' && !approvalPresent) return { decision: 'REVIEW', reason: 'HUMAN_APPROVAL_REQUIRED' }
  return { decision: decision === 'REVIEW' ? 'AUTO' : decision, reason: 'POLICY_SATISFIED' }
}

export function assertActionMayExecute(input) {
  const result = decideExecutionPolicy(input)
  if (result.decision !== 'AUTO') {
    const error = new Error(result.reason)
    error.code = result.decision === 'REVIEW' ? 'ACTION_REQUIRES_REVIEW' : 'ACTION_BLOCKED'
    error.policy = result
    throw error
  }
  return result
}
