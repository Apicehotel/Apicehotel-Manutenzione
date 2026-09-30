// Explicit vendor/tool allowlist. MCP metadata is discovery data, never authorization.
// Unknown servers and tools fail closed; do not add mutating or SQL execution tools.
export const MCP_READ_POLICY = Object.freeze({
  github: Object.freeze(['get_file_contents', 'list_pull_requests', 'pull_request_read']),
  supabase: Object.freeze(['list_tables', 'list_extensions', 'list_migrations', 'get_advisors']),
  'digitalocean-apps': Object.freeze([]), // Activate after auditing exact vendor tool names.
  sentry: Object.freeze(['search_issues', 'get_issue_details']),
  context7: Object.freeze(['resolve-library-id', 'query-docs', 'get-library-docs']),
  figma: Object.freeze(['get_design_context', 'get_metadata', 'get_variable_defs']),
  bladewindui: Object.freeze(['list_components', 'get_component_docs', 'search_components']),
  vercel: Object.freeze([]), // Vercel diagnostic access stays disabled until audit.
})

// BladewindUI publishes a documented docs-only surface but might omit MCP hints.
// All other providers must independently assert readOnlyHint === true.
const AUDITED_DOCS_ONLY = new Set(['bladewindui'])
const HOTEL_IDS = new Set(['hotelgio', 'chocohotel', 'brigantino'])
const GITHUB_REPOS = new Set(['Apicehotel-Manutenzione', 'Eye-Supremo-', 'RandAIlive'])

export function enabledMcpServer(serverId, getEnv) {
  return Object.hasOwn(MCP_READ_POLICY, serverId) &&
    getEnv('MCP_ENABLE_' + serverId.replace(/[^a-z0-9]/g, '_').toUpperCase()) === 'true'
}

export function assertMcpHotel(hotelId) {
  if (!HOTEL_IDS.has(hotelId)) throw new Error('MCP_HOTEL_SCOPE_INVALID')
  return hotelId
}

export function isAllowedMcpTool(serverId, tool) {
  if (!Object.hasOwn(MCP_READ_POLICY, serverId) || !tool?.name) return false
  if (!MCP_READ_POLICY[serverId].includes(tool.name)) return false
  if (tool.annotations?.readOnlyHint === false) return false
  return tool.annotations?.readOnlyHint === true || AUDITED_DOCS_ONLY.has(serverId)
}

export function assertMcpArguments(serverId, toolName, input) {
  if (!Object.hasOwn(MCP_READ_POLICY, serverId) || !MCP_READ_POLICY[serverId].includes(toolName)) {
    throw new Error('MCP_TOOL_NOT_ALLOWED')
  }
  if (input == null || typeof input !== 'object' || Array.isArray(input)) throw new Error('MCP_ARGUMENTS_INVALID')
  const serialized = JSON.stringify(input)
  if (!serialized || serialized.length > 8192 || /"(__proto__|constructor|prototype)"\s*:/.test(serialized)) {
    throw new Error('MCP_ARGUMENTS_INVALID')
  }
  if (serverId === 'github') {
    if (input.owner !== 'Apicehotel' || !GITHUB_REPOS.has(input.repo)) throw new Error('MCP_REPOSITORY_SCOPE_DENIED')
  }
  return input
}
