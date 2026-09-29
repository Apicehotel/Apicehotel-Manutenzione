import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RandCapability, createMcpBrokerCapabilityProvider } from '../src/randai/core/capability-providers.js'
import { createMcpCapabilityTools } from '../src/randai/tools/mcp-capability-tools.js'

test('MCP broker provider exposes read-only Rand capabilities', () => {
  const provider = createMcpBrokerCapabilityProvider({ invoke: async () => ({ ok: true }) })
  assert.equal(provider.id, 'mcp-broker')
  for (const capability of [
    RandCapability.REPOSITORY_INSPECT,
    RandCapability.DATABASE_INSPECT,
    RandCapability.DEPLOYMENT_INSPECT,
    RandCapability.ERROR_INSPECT,
    RandCapability.DOCS_LOOKUP,
    RandCapability.DESIGN_INSPECT,
    RandCapability.UI_REFERENCE,
  ]) assert.ok(provider.capabilities.includes(capability))
  assert.ok(!provider.capabilities.includes(RandCapability.OPERATIONAL_ACTION))
})

test('MCP capability tools remain low-risk read-only tools', async () => {
  const calls = []
  const router = {
    invoke: async (capability, input, options) => {
      calls.push({ capability, input, options })
      return { value: { ok: true }, trace: { providerId: 'mcp-broker' } }
    },
  }
  const tools = createMcpCapabilityTools({ router })
  assert.ok(tools.length >= 7)
  assert.ok(tools.every((tool) => tool.permission === 'READ'))
  assert.ok(tools.every((tool) => tool.risk === 'LOW'))
  const result = await tools[0].execute({ tool: 'search' }, { hotelId: 'hotelgio' })
  assert.equal(result.status, 'SUCCESS')
  assert.equal(calls[0].options.allowExecutionFallback, true)
})

test('external MCP tools never expose operational write capability', () => {
  const tools = createMcpCapabilityTools({ router: { invoke: async () => ({ value: {}, trace: { providerId: 'x' } }) } })
  assert.equal(tools.some((tool) => tool.id.includes('operational')), false)
})

test('MCP broker is server-side, hotel-scoped and admin restricted', () => {
  const source = fs.readFileSync(new URL('../supabase/functions/rand-capability-broker/index.ts', import.meta.url), 'utf8')
  assert.match(source, /hotel_required/)
  assert.match(source, /hotel_memberships/)
  assert.match(source, /\['admin', 'RandAI'\]/)
  assert.match(source, /mcp_write_tool_denied/)
  assert.match(source, /readOnlyHint/)
})
