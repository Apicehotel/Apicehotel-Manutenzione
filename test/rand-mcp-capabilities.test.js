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
  assert.match(source, /isAuthorizedMcpMembership/)
  assert.match(source, /mcp_write_tool_denied/)
  const policySource = fs.readFileSync(new URL('../supabase/functions/_shared/mcp-read-policy.js', import.meta.url), 'utf8')
  assert.match(policySource, /readOnlyHint/)
})


import {
  MCP_READ_POLICY, assertMcpArguments, enabledMcpServer, isAllowedMcpTool, isAuthorizedMcpMembership,
} from '../supabase/functions/_shared/mcp-read-policy.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { registerMcpCapabilityTools } from '../src/randai/tools/mcp-capability-tools.js'
import { RandMindCognitiveLoop } from '../src/randai/agents/cognitive-loop.js'

test('MCP deny-by-default: unknown tools, mutations, provider flags', () => {
  assert.equal(isAllowedMcpTool('github', { name: 'delete_file', annotations: { readOnlyHint: true } }), false)
  assert.equal(isAllowedMcpTool('github', { name: 'get_file_contents', annotations: { readOnlyHint: false } }), false)
  assert.equal(isAllowedMcpTool('github', { name: 'get_file_contents', annotations: { readOnlyHint: true } }), true)
  assert.equal(isAllowedMcpTool('unknown', { name: 'whatever', annotations: { readOnlyHint: true } }), false)
  assert.equal(isAllowedMcpTool('bladewindui', { name: 'get_component_docs' }), true)
  assert.equal(isAllowedMcpTool('bladewindui', { name: 'get_component_docs', annotations: { readOnlyHint: false } }), false)
  assert.equal(enabledMcpServer('github', () => ''), false)
  assert.equal(enabledMcpServer('github', (name) => name === 'MCP_ENABLE_GITHUB' ? 'true' : ''), true)
  assert.equal(MCP_READ_POLICY['digitalocean-apps'].length, 0)
})

test('MCP repo scope and argument payload are bounded', () => {
  assert.deepEqual(assertMcpArguments('github', 'get_file_contents',
    { owner: 'Apicehotel', repo: 'Apicehotel-Manutenzione', path: 'README.md' }),
  { owner: 'Apicehotel', repo: 'Apicehotel-Manutenzione', path: 'README.md' })
  assert.throws(() => assertMcpArguments('github', 'get_file_contents', { owner: 'foreign', repo: 'secrets' }), /MCP_REPOSITORY_SCOPE_DENIED/)
  assert.throws(() => assertMcpArguments('github', 'delete_file', {}), /MCP_TOOL_NOT_ALLOWED/)
  assert.throws(() => assertMcpArguments('supabase', 'execute_sql', { query: 'delete from public.segnalazioni' }), /MCP_TOOL_NOT_ALLOWED/)
  assert.throws(() => assertMcpArguments('context7', 'query-docs', { query: 'x'.repeat(9000) }), /MCP_ARGUMENTS_INVALID/)
})

test('MCP authorization requires exact active hotel and admin/RandAI role', () => {
  assert.equal(isAuthorizedMcpMembership('hotelgio', { active: true, role: 'admin' }), true)
  assert.equal(isAuthorizedMcpMembership('brigantino', { active: true, role: 'RandAI' }), true)
  assert.equal(isAuthorizedMcpMembership('chocohotel', { active: true, role: 'maintenance' }), false)
  assert.equal(isAuthorizedMcpMembership('hotelgio', { active: false, role: 'admin' }), false)
  assert.equal(isAuthorizedMcpMembership('otherhotel', { active: true, role: 'admin' }), false)
  assert.equal(isAuthorizedMcpMembership('hotelgio', null), false)
})

test('MCP tool registration is idempotent and RandMind only advertises caller-allowed tools', async () => {
  const tools = new ToolRegistry()
  const router = { invoke: async () => ({ value: { ok: true }, trace: { providerId: 'mcp-broker' } }) }
  registerMcpCapabilityTools(tools, { router })
  registerMcpCapabilityTools(tools, { router })
  assert.equal(tools.list().filter((tool) => tool.id === 'mcp.github.inspect').length, 1)

  let captured
  const loop = new RandMindCognitiveLoop({
    runtime: { run: async (params) => { captured = params; return { ok: true, runId: 'test' } } },
    skillRegistry: { discover: () => [], inspect: () => null },
    toolRegistry: tools,
    skillRouter: { route: () => ({ skillIds: [], requiredToolPatterns: [], requiredPermissions: ['READ'], mode: 'explicit' }) },
  })
  await loop.run({ objective: 'inspect repo', context: { hotelId: 'hotelgio' }, allowedToolIds: [] })
  assert.equal(captured.context.randMind.tools.length, 0)
  await loop.run({ objective: 'inspect repo', context: { hotelId: 'hotelgio' }, allowedToolIds: ['mcp.github.inspect'] })
  assert.deepEqual(captured.context.randMind.tools.map((tool) => tool.id), ['mcp.github.inspect'])
})
