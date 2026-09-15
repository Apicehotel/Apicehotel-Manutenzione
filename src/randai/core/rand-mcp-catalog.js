// Canonical metadata for the public Rand MCP surface. Execution and policy
// remain owned by RandGateway/RandSecure; this catalog only describes what the
// adapter may expose.
export const RAND_MCP_TOOL_CATALOG = Object.freeze([
  Object.freeze({ name: 'issue.update_priority', permission: 'WRITE', risk: 'MEDIUM', requiredScopes: ['issues:edit'], requiresHitl: true }),
  Object.freeze({ name: 'issue.set_waiting_part', permission: 'WRITE_PROTECTED', risk: 'MEDIUM', requiredScopes: ['issues:take_charge'], requiresHitl: true }),
  Object.freeze({ name: 'issue.mark_done', permission: 'WRITE_PROTECTED', risk: 'HIGH', requiredScopes: ['issues:complete'], requiresHitl: true }),
])

export function listRandMcpToolNames() {
  return RAND_MCP_TOOL_CATALOG.map((tool) => tool.name)
}

export function getRandMcpTool(name) {
  return RAND_MCP_TOOL_CATALOG.find((tool) => tool.name === name) || null
}
