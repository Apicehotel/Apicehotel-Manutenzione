import { ToolPermission, ToolRisk } from '../tools/contracts.js'

export const ExecutionDisposition = Object.freeze({
  AUTO: 'AUTO',
  PREVIEW: 'PREVIEW',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  BLOCK: 'BLOCK',
})

export const RiskClass = Object.freeze({
  READ_ONLY: 'READ_ONLY',
  LOW_RISK: 'LOW_RISK',
  MEDIUM_RISK: 'MEDIUM_RISK',
  HIGH_RISK: 'HIGH_RISK',
  CRITICAL: 'CRITICAL',
})

export function classifyExecutionRisk(tool = {}) {
  if (tool.risk === ToolRisk.CRITICAL) return RiskClass.CRITICAL
  if (tool.permission === ToolPermission.READ) return RiskClass.READ_ONLY
  if (tool.risk === ToolRisk.HIGH || tool.permission === ToolPermission.ADMIN || tool.permission === ToolPermission.WRITE_PROTECTED) return RiskClass.HIGH_RISK
  if (tool.risk === ToolRisk.MEDIUM) return RiskClass.MEDIUM_RISK
  return RiskClass.LOW_RISK
}

export function executionPolicyForTool(tool = {}) {
  const riskClass = classifyExecutionRisk(tool)
  if (riskClass === RiskClass.CRITICAL) return Object.freeze({ riskClass, disposition: ExecutionDisposition.BLOCK, auditRequired: true })
  if (riskClass === RiskClass.HIGH_RISK) return Object.freeze({ riskClass, disposition: ExecutionDisposition.REQUIRE_APPROVAL, auditRequired: true })
  if (riskClass === RiskClass.MEDIUM_RISK) return Object.freeze({ riskClass, disposition: ExecutionDisposition.PREVIEW, auditRequired: true })
  return Object.freeze({ riskClass, disposition: ExecutionDisposition.AUTO, auditRequired: riskClass !== RiskClass.READ_ONLY })
}
