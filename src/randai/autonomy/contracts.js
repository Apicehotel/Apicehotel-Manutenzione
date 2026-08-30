import { ToolPermission, ToolRisk } from '../tools/contracts.js'

export const AutonomyLevel = Object.freeze({
  OBSERVE: 'L0_OBSERVE',
  SUGGEST: 'L1_SUGGEST',
  PREPARE: 'L2_PREPARE',
  EXECUTE_SAFE: 'L3_EXECUTE_SAFE',
  AUTONOMOUS: 'L4_AUTONOMOUS',
})

export const AutonomyDecision = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  PREPARE_ONLY: 'PREPARE_ONLY',
  OBSERVE_ONLY: 'OBSERVE_ONLY',
})

export const ApprovalStatus = Object.freeze({ PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', EXPIRED: 'EXPIRED' })

export const AUTONOMY_LEVEL_ORDER = Object.freeze([
  AutonomyLevel.OBSERVE,
  AutonomyLevel.SUGGEST,
  AutonomyLevel.PREPARE,
  AutonomyLevel.EXECUTE_SAFE,
  AutonomyLevel.AUTONOMOUS,
])

export const RISK_ORDER = Object.freeze([ToolRisk.LOW, ToolRisk.MEDIUM, ToolRisk.HIGH, ToolRisk.CRITICAL])

export function validateAutonomyPolicy(policy) {
  if (!policy?.id || !policy?.level) throw new TypeError('Autonomy policy requires id and level')
  if (!AUTONOMY_LEVEL_ORDER.includes(policy.level)) throw new TypeError(`Invalid autonomy level: ${policy.level}`)
  if (policy.maxRisk && !RISK_ORDER.includes(policy.maxRisk)) throw new TypeError(`Invalid max risk: ${policy.maxRisk}`)
  for (const key of ['allowedTools', 'deniedTools']) if (policy[key] != null && !Array.isArray(policy[key])) throw new TypeError(`${key} must be an array`)
  return true
}

export function actionIdentity({ toolId, taskId = null, stepId = null, input = null } = {}) {
  if (!toolId) throw new TypeError('toolId is required')
  const serialized = input == null ? '' : JSON.stringify(input)
  return `${toolId}|${taskId || ''}|${stepId || ''}|${serialized}`
}

export function requiresHumanByTool(tool) {
  return tool?.risk === ToolRisk.CRITICAL || tool?.permission === ToolPermission.ADMIN
}
