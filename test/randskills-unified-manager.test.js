import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildUnifiedRandCapabilityCatalog,
  filterUnifiedRandCapabilityCatalog,
  summarizeUnifiedRandCapabilityCatalog,
} from '../src/randai/skills/unified-catalog.js'

test('unified RandSkills catalog contains canonical skills and MCP without duplicate keys', () => {
  const catalog = buildUnifiedRandCapabilityCatalog()
  assert.ok(catalog.skills.length >= 7)
  assert.ok(catalog.mcp.length >= 9)
  assert.equal(catalog.items.length, catalog.skills.length + catalog.mcp.length)
  const keys = catalog.items.map((item) => item.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(catalog.skills.every((item) => item.kind === 'skill' && item.source))
  assert.ok(catalog.mcp.every((item) => item.kind === 'mcp' && item.permissions.length))
})

test('MCP profiles only reference catalogued servers', () => {
  const catalog = buildUnifiedRandCapabilityCatalog()
  const known = new Set(catalog.mcp.map((item) => item.id))
  for (const profile of catalog.profiles) {
    assert.deepEqual(profile.knownServers, profile.serverIds)
    assert.ok(profile.serverIds.every((id) => known.has(id)), `unknown MCP in profile ${profile.id}`)
  }
})

test('unified catalog filters across skill, MCP, capability and profile', () => {
  const catalog = buildUnifiedRandCapabilityCatalog()
  assert.ok(filterUnifiedRandCapabilityCatalog(catalog,{kind:'skill',query:'manutenzione'}).some((item)=>item.id==='maintenance'))
  assert.ok(filterUnifiedRandCapabilityCatalog(catalog,{kind:'mcp',query:'database.inspect'}).some((item)=>item.id==='supabase'))
  assert.ok(filterUnifiedRandCapabilityCatalog(catalog,{profile:'rand-designer'}).some((item)=>item.id==='figma'))
  assert.equal(filterUnifiedRandCapabilityCatalog(catalog,{kind:'skill',profile:'rand-designer'}).length,0)
})

test('live MCP status augments inventory without redefining registry truth', () => {
  const catalog = buildUnifiedRandCapabilityCatalog()
  const summary = summarizeUnifiedRandCapabilityCatalog(catalog,[
    {serverId:'github',enabled:true,credentialsReady:true,status:'CONFIGURED_NOT_PROBED'},
    {serverId:'supabase',enabled:false,credentialsReady:true,status:'DISABLED'},
  ])
  assert.equal(summary.enabledMcpCount,1)
  assert.equal(summary.configuredMcpCount,2)
  assert.equal(summary.mcp.find((item)=>item.id==='github').live.enabled,true)
  assert.equal(summary.mcp.find((item)=>item.id==='figma').live,null)
})

test('RandAI admin console exposes one Skill & MCP manager tab', () => {
  const source = fs.readFileSync(new URL('../src/randai/control/RandAIAdminConsole.jsx', import.meta.url), 'utf8')
  assert.match(source, /\['skills', 'Skill & MCP'\]/)
  assert.match(source, /<RandSkillsConsole/)
  assert.equal((source.match(/Skill & MCP/g)||[]).length,1)
})
