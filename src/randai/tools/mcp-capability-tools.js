import { randCapabilityRouter } from '../core/capability-runtime.js'
import { RandCapability } from '../core/capability-providers.js'
import { ToolPermission, ToolRisk, toolSuccess } from './contracts.js'

const DEFINITIONS = Object.freeze([
  ['mcp.github.inspect', 'GitHub MCP', RandCapability.REPOSITORY_INSPECT],
  ['mcp.supabase.inspect', 'Supabase MCP', RandCapability.DATABASE_INSPECT],
  ['mcp.deployment.inspect', 'Deployment MCP', RandCapability.DEPLOYMENT_INSPECT],
  ['mcp.sentry.inspect', 'Sentry MCP', RandCapability.ERROR_INSPECT],
  ['mcp.context7.lookup', 'Context7 MCP', RandCapability.DOCS_LOOKUP],
  ['mcp.figma.inspect', 'Figma MCP', RandCapability.DESIGN_INSPECT],
  ['mcp.bladewindui.lookup', 'BladewindUI MCP', RandCapability.UI_REFERENCE],
])

export function createMcpCapabilityTools({ router = randCapabilityRouter } = {}) {
  if (!router?.invoke) throw new TypeError('MCP capability tools require a capability router')
  return DEFINITIONS.map(([id, name, capability]) => ({
    id,
    name,
    description: `Read-only MCP capability: ${capability}`,
    risk: ToolRisk.LOW,
    permission: ToolPermission.READ,
    idempotent: true,
    retryPolicy: { maxAttempts: 2, delayMs: 150 },
    execute: async (input = {}, context = {}) => {
      const { value, trace } = await router.invoke(capability, input, {
        context,
        allowExecutionFallback: true,
      })
      return toolSuccess(value, { capability, providerId: trace.providerId })
    },
  }))
}

export function registerMcpCapabilityTools(toolRegistry, options = {}) {
  if (!toolRegistry?.register) throw new TypeError('Tool registry required')
  return createMcpCapabilityTools(options).map((tool) => toolRegistry.register(tool))
}
