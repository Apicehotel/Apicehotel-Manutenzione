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

function uniqueStrings(values, name) {
  if (values == null) return []
  if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`)
  if (values.some((value) => !String(value || '').trim())) throw new TypeError(`${name} must contain non-empty tool ids`)
  if (new Set(values).size !== values.length) throw new TypeError(`${name} must not contain duplicates`)
  return values
}

export function validateAutonomyPolicy(policy) {
  if (!policy?.id || !policy?.level) throw new TypeError('Autonomy policy requires id and level')
  if (!AUTONOMY_LEVEL_ORDER.includes(policy.level)) throw new TypeError(`Invalid autonomy level: ${policy.level}`)
  if (policy.maxRisk && !RISK_ORDER.includes(policy.maxRisk)) throw new TypeError(`Invalid max risk: ${policy.maxRisk}`)
  const allowed = uniqueStrings(policy.allowedTools, 'allowedTools')
  const denied = uniqueStrings(policy.deniedTools, 'deniedTools')
  const overlap = allowed.find((toolId) => denied.includes(toolId))
  if (overlap) throw new TypeError(`Tool cannot be both allowed and denied: ${overlap}`)
  return true
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`
}

export function actionScope({ hotelId = null, scope = null } = {}) {
  if (hotelId) return `hotel:${hotelId}`
  if (scope === 'global') return 'global'
  return 'unscoped'
}

export function actionIdentity({ toolId, taskId = null, stepId = null, input = null, hotelId = null, scope = null } = {}) {
  if (!toolId) throw new TypeError('toolId is required')
  const serialized = input == null ? '' : stableSerialize(input)
  return `${actionScope({ hotelId, scope })}|${toolId}|${taskId || ''}|${stepId || ''}|${serialized}`
}

export function requiresHumanByTool(tool) {
  return tool?.risk === ToolRisk.CRITICAL || tool?.permission === ToolPermission.ADMIN
}
