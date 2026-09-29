import { submitRandGatewayEnvelope } from '../../randgateway-client.js'
import { invokeMcpBroker } from './mcp-broker-client.js'

export const RandCapability = Object.freeze({
  OPERATIONAL_ACTION: 'operational.action',
  REPOSITORY_INSPECT: 'repository.inspect',
  DATABASE_INSPECT: 'database.inspect',
  DEPLOYMENT_INSPECT: 'deployment.inspect',
  BROWSER_TEST: 'browser.test',
  ERROR_INSPECT: 'error.inspect',
  DOCS_LOOKUP: 'docs.lookup',
  DESIGN_INSPECT: 'design.inspect',
  UI_REFERENCE: 'ui.reference',
})

export const MCP_BROKER_CAPABILITIES = Object.freeze([
  RandCapability.REPOSITORY_INSPECT,
  RandCapability.DATABASE_INSPECT,
  RandCapability.DEPLOYMENT_INSPECT,
  RandCapability.ERROR_INSPECT,
  RandCapability.DOCS_LOOKUP,
  RandCapability.DESIGN_INSPECT,
  RandCapability.UI_REFERENCE,
])

export function createRandGatewayCapabilityProvider({
  submit = submitRandGatewayEnvelope,
  isAvailable = () => true,
} = {}) {
  if (typeof submit !== 'function') throw new TypeError('submit deve essere una funzione')

  return {
    id: 'randgateway',
    capabilities: [RandCapability.OPERATIONAL_ACTION],
    priority: 10,
    isAvailable,
    getHealth: async ({ context } = {}) => ({
      status: await isAvailable({ capability: RandCapability.OPERATIONAL_ACTION, context }) ? 'HEALTHY' : 'DISABLED',
    }),
    execute: async ({ input }) => submit(input?.envelope),
  }
}

export function createMcpBrokerCapabilityProvider({
  invoke = invokeMcpBroker,
  isAvailable = () => true,
} = {}) {
  if (typeof invoke !== 'function') throw new TypeError('invoke deve essere una funzione')
  return {
    id: 'mcp-broker',
    capabilities: MCP_BROKER_CAPABILITIES,
    priority: 20,
    isAvailable,
    getHealth: async ({ context } = {}) => ({
      status: await isAvailable({ context }) ? 'HEALTHY' : 'DISABLED',
    }),
    execute: async ({ capability, input, context }) => invoke(capability, input, context),
  }
}

export function createPlaywrightCapabilityProvider({
  execute,
  isAvailable = () => true,
} = {}) {
  if (typeof execute !== 'function') throw new TypeError('Playwright provider richiede execute')
  return {
    id: 'playwright-mcp',
    capabilities: [RandCapability.BROWSER_TEST],
    priority: 10,
    isAvailable,
    execute: async ({ input, context }) => execute(input, context),
  }
}
