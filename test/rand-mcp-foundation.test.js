import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const registry = JSON.parse(fs.readFileSync(new URL('../config/mcp/registry.json', import.meta.url), 'utf8'))

test('Rand MCP registry keeps safe defaults', () => {
  assert.equal(registry.policy.defaultMode, 'read-only')
  assert.equal(registry.policy.noSecretsInRepository, true)
  assert.equal(registry.policy.writesRequireRandGateway, true)
})

test('critical MCP servers are registered once', () => {
  const ids = registry.servers.map((server) => server.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ['rand-internal', 'github', 'supabase', 'digitalocean-apps', 'playwright', 'figma', 'sentry', 'context7', 'bladewindui']) {
    assert.ok(ids.includes(id), `missing MCP server: ${id}`)
  }
})

test('GitHub and Supabase default to constrained access', () => {
  const github = registry.servers.find((server) => server.id === 'github')
  const supabase = registry.servers.find((server) => server.id === 'supabase')
  assert.equal(github.headers['X-MCP-Readonly'], 'true')
  assert.equal(github.headers['X-MCP-Lockdown'], 'true')
  assert.match(supabase.url, /project_ref=ooqlfldcrnkudhgjnied/)
  assert.match(supabase.url, /read_only=true/)
})

test('Rand internal MCP belongs on Ocean and keeps RandGateway authority', () => {
  const rand = registry.servers.find((server) => server.id === 'rand-internal')
  assert.equal(rand.placement, 'digitalocean-app-platform')
  assert.match(rand.authority, /RandGateway/)
})
