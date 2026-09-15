import { stableJson } from '../stable-json.js'

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max)

export function approvalMatchesToolRequest(approval, toolRequest) {
  if (!approval || !toolRequest) return false
  const approvedAction = approval.payload?.action || {}
  const requestedArguments = toolRequest.arguments || {}
  const approvedType = clean(approvedAction.type || approval.action_type || approval.tool_id, 180)
  const approvedResourceId = clean(approvedAction.resourceId || approvedAction.resource_id || approval.resource_id, 120)
  const requestedResourceId = clean(requestedArguments.resourceId || requestedArguments.resource_id, 120)

  if (!approvedType || approvedType !== clean(toolRequest.name, 180)) return false
  if (!approvedResourceId || approvedResourceId !== requestedResourceId) return false
  return stableJson(approvedAction.input || {}) === stableJson(requestedArguments.input || {})
}
