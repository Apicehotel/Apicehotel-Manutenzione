import { ToolPermission, ToolRisk } from '../tools/contracts.js'
import { SoftwareStage, validateSoftwareSpec } from './contracts.js'

const riskOrder = [ToolRisk.LOW, ToolRisk.MEDIUM, ToolRisk.HIGH, ToolRisk.CRITICAL]
const riskRank = (risk) => riskOrder.indexOf(risk || ToolRisk.LOW)

export function assessSoftwareReadiness({
  spec,
  availableTools = null,
  permissions = null,
  prerequisites = {},
} = {}) {
  validateSoftwareSpec(spec)
  const issues = []
  const tools = Array.isArray(availableTools) ? new Set(availableTools) : null
  const granted = Array.isArray(permissions) ? new Set(permissions) : null
  let highestRisk = ToolRisk.LOW

  if (!tools) issues.push({ code: 'TOOL_INVENTORY_MISSING' })
  if (!granted) issues.push({ code: 'PERMISSION_CONTEXT_MISSING' })

  for (const step of spec.proposedPlan.steps) {
    const stepRisk = step.risk || ToolRisk.LOW
    if (!riskOrder.includes(stepRisk)) issues.push({ code: 'INVALID_RISK', stepId: step.id, risk: stepRisk })
    if (riskRank(stepRisk) > riskRank(highestRisk)) highestRisk = stepRisk
    if (step.hotelId && spec.metadata?.hotelId && step.hotelId !== spec.metadata.hotelId) {
      issues.push({ code: 'HOTEL_SCOPE_MISMATCH', stepId: step.id })
    }
    for (const strategy of step.strategies || (step.action ? [step.action] : [])) {
      if (tools && !tools.has(strategy.toolId)) issues.push({ code: 'TOOL_UNAVAILABLE', stepId: step.id, toolId: strategy.toolId })
    }
    if (step.permission && granted && !granted.has(step.permission)) {
      issues.push({ code: 'PERMISSION_MISSING', stepId: step.id, permission: step.permission })
    }
    for (const key of step.requires || []) {
      if (!prerequisites[key]) issues.push({ code: 'PREREQUISITE_MISSING', stepId: step.id, prerequisite: key })
    }
  }

  const reviewRequired = highestRisk === ToolRisk.HIGH
    || highestRisk === ToolRisk.CRITICAL
    || spec.proposedPlan.steps.some((step) => [ToolPermission.WRITE_PROTECTED, ToolPermission.ADMIN].includes(step.permission))
  return Object.freeze({
    ok: issues.length === 0,
    stage: SoftwareStage.REVIEW,
    issues: Object.freeze(issues),
    highestRisk,
    reviewRequired,
    projectId: spec.projectId,
    hotelId: spec.metadata?.hotelId || null,
  })
}
