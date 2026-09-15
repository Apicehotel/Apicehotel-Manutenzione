import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { listRandMcpToolNames, RAND_MCP_TOOL_CATALOG } from '../src/randai/core/rand-mcp-catalog.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Group 1 keeps one bounded MCP catalog across adapter and policy', () => {
  const api = read('api/mcp.js')
  const migration = read('supabase/migrations/20260912210819_randgateway_point7_foundation.sql')
  assert.deepEqual(listRandMcpToolNames(), ['issue.update_priority', 'issue.set_waiting_part', 'issue.mark_done'])
  assert.equal(new Set(RAND_MCP_TOOL_CATALOG.map((tool) => tool.name)).size, RAND_MCP_TOOL_CATALOG.length)
  for (const name of listRandMcpToolNames()) {
    assert.match(api, new RegExp(`registerTool\\(['"]${name.replace('.', '\\.')}`))
    assert.match(migration, new RegExp(`'mcp','rand-internal','${name.replace('.', '\\.')}'`))
  }
  assert.doesNotMatch(api, /service[_-]?role/i)
})

test('Group 1 keeps production entrypoints behind one gateway', () => {
  const architecture = read('docs/architecture/RANDGATEWAY_POINT7.md')
  const twilio = read('supabase/functions/randai-whatsapp-inbound/index.ts')
  assert.match(architecture, /RandGateway.*Tool Gateway.*RandSecure.*HITL.*Action Gateway.*RandAudit/s)
  assert.match(twilio, /whatsappGateway\(\)\.handle\(envelope\)/)
})
