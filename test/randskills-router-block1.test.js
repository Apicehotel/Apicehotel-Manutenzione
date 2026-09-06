import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCanonicalRandSkills } from '../src/randai/skills/canonical.js'
import { RandSkillRouter, matchesToolPattern } from '../src/randai/skills/router.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolPermission, ToolRisk } from '../src/randai/tools/contracts.js'
import { RandMindCognitiveLoop } from '../src/randai/agents/cognitive-loop.js'

function router() { return new RandSkillRouter({ skillRegistry: registerCanonicalRandSkills() }) }

function tools() {
  const registry = new ToolRegistry()
  registry.register({ id: 'maintenance.read', name: 'Maintenance read', execute: async () => ({}), risk: ToolRisk.LOW, permission: ToolPermission.READ })
  registry.register({ id: 'warehouse.read', name: 'Warehouse read', execute: async () => ({}), risk: ToolRisk.LOW, permission: ToolPermission.READ })
  registry.register({ id: 'admin.secret', name: 'Admin secret', execute: async () => ({}), risk: ToolRisk.CRITICAL, permission: ToolPermission.ADMIN })
  return registry
}

test('router: maintenance intent selects maintenance with confidence and evidence', () => {
  const decision = router().route({ objective: 'Lampadina fulminata in camera 214, serve intervento tecnico' })
  assert.equal(decision.fallbackRequired, false)
  assert.ok(decision.skillIds.includes('maintenance'))
  assert.ok(decision.confidence >= 0.35)
  assert.ok(decision.matches.find((item) => item.id === 'maintenance')?.reasons.length)
})

test('router: combined operational intent composes maintenance and warehouse', () => {
  const decision = router().route({ objective: 'Guasto: serve un ricambio dal magazzino per la riparazione' })
  assert.equal(decision.mode, 'COMPOSED')
  assert.ok(decision.skillIds.includes('maintenance'))
  assert.ok(decision.skillIds.includes('warehouse'))
})

test('router: repo requests prefer Repo Radar', () => {
  const decision = router().route({ objective: 'Valuta questa repository GitHub e dimmi se sostituisce una dipendenza' })
  assert.equal(decision.skillIds[0], 'repo-radar')
})

test('router: unknown intent fails closed instead of inventing a skill', () => {
  const decision = router().route({ objective: 'parlami del colore del cielo' })
  assert.equal(decision.mode, 'FALLBACK')
  assert.equal(decision.fallbackRequired, true)
  assert.deepEqual(decision.skillIds, [])
})

test('router: explicit approved skill is deterministic', () => {
  const decision = router().route({ objective: 'qualunque cosa', explicitSkillIds: ['procedures'] })
  assert.equal(decision.mode, 'EXPLICIT')
  assert.deepEqual(decision.skillIds, ['procedures'])
  assert.equal(decision.confidence, 1)
})

test('tool pattern matcher is anchored and supports governed wildcards', () => {
  assert.equal(matchesToolPattern('maintenance.read', 'maintenance.*'), true)
  assert.equal(matchesToolPattern('admin.maintenance.read', 'maintenance.*'), false)
  assert.equal(matchesToolPattern('warehouse.read', 'warehouse.read'), true)
})

test('cognitive loop intersects caller authorization, skill binding and risk', async () => {
  let received
  const runtime = { run: async (request) => { received = request; return { ok: true, runId: 'RUN-ROUTER', trace: [] } } }
  const loop = new RandMindCognitiveLoop({ runtime, skillRegistry: registerCanonicalRandSkills(), toolRegistry: tools() })
  const result = await loop.run({
    objective: 'Lampadina fulminata: controlla manutenzione',
    context: { hotelId: 'hotelgio' },
    allowedToolIds: ['maintenance.read', 'warehouse.read', 'admin.secret'],
    maxToolRisk: ToolRisk.CRITICAL,
  })
  assert.deepEqual(received.context.randMind.tools.map((tool) => tool.id), ['maintenance.read', 'warehouse.read'])
  assert.ok(result.randMind.routing.skillIds.includes('maintenance'))
  assert.equal(result.randMind.routing.fallbackRequired, false)
})
