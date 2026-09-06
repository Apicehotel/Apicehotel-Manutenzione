import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCanonicalRandSkills } from '../src/randai/skills/canonical.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolPermission, ToolRisk } from '../src/randai/tools/contracts.js'
import { ToolsetResolver } from '../src/randai/tools/toolsets.js'
import { RandMindCognitiveLoop } from '../src/randai/agents/cognitive-loop.js'
import { LearningEngine } from '../src/randai/learning/engine.js'
import { learningPromotionDecision, LearningPromotionMode } from '../src/randai/learning/promotion-policy.js'

function tools() {
  const registry = new ToolRegistry()
  registry.register({ id: 'read.rooms', name: 'Read rooms', execute: async () => ({}), risk: ToolRisk.LOW, permission: ToolPermission.READ })
  registry.register({ id: 'write.issue', name: 'Write issue', execute: async () => ({}), risk: ToolRisk.HIGH, permission: ToolPermission.WRITE_PROTECTED })
  return registry
}

test('block2: canonical RandSkills reuse the existing SkillRegistry', () => {
  const registry = registerCanonicalRandSkills()
  const skills = registry.list()
  assert.equal(skills.length, 7)
  assert.ok(skills.every((skill) => skill.status === 'APPROVED'))
  assert.equal(registry.inspect('maintenance').metadata.source, 'rand-skills/maintenance/SKILL.md')
})

test('block2: tool visibility is intersection of authorization and risk', () => {
  const resolver = new ToolsetResolver({ toolRegistry: tools() })
  assert.deepEqual(resolver.resolve({ allowedToolIds: ['read.rooms', 'write.issue'], maxRisk: ToolRisk.LOW }).map((tool) => tool.id), ['read.rooms'])
  assert.deepEqual(resolver.resolve({ allowedToolIds: ['read.rooms'], maxRisk: ToolRisk.CRITICAL }).map((tool) => tool.id), ['read.rooms'])
})

test('block2: cognitive loop keeps hotel scope and exposes only bounded skills/tools', async () => {
  let received = null
  const runtime = { run: async (request) => { received = request; return { ok: true, runId: 'RUN-1', trace: [] } } }
  const loop = new RandMindCognitiveLoop({ runtime, skillRegistry: registerCanonicalRandSkills(), toolRegistry: tools() })
  const result = await loop.run({ objective: 'maintenance issue', context: { hotelId: 'hotelgio' }, skillIds: ['maintenance'], allowedToolIds: ['read.rooms', 'write.issue'], maxToolRisk: ToolRisk.LOW })
  assert.equal(received.context.hotelId, 'hotelgio')
  assert.deepEqual(received.context.randMind.skills.map((skill) => skill.id), ['maintenance'])
  assert.deepEqual(received.context.randMind.tools.map((tool) => tool.id), ['read.rooms'])
  assert.deepEqual(result.randMind.tools.map((tool) => tool.id), ['read.rooms'])
})

test('block2: learning only accepts verified operational outcomes', async () => {
  const runtime = { run: async () => ({ ok: true, runId: 'RUN-VERIFIED', trace: [] }) }
  const loop = new RandMindCognitiveLoop({ runtime, skillRegistry: registerCanonicalRandSkills(), toolRegistry: tools(), learningEngine: new LearningEngine({ minEvidence: 2 }) })
  await assert.rejects(() => loop.run({ objective: 'maintenance issue', context: { hotelId: 'hotelgio' }, learningObservation: { problemClass: 'lamp', strategy: 'replace e27', verified: false, source: { kind: 'intervention', id: 'INT-1' } } }), /Only verified experiences can be learned/)
  const result = await loop.run({ objective: 'maintenance issue', context: { hotelId: 'hotelgio' }, learningObservation: { problemClass: 'lamp', strategy: 'replace e27', verified: true, source: { kind: 'intervention', id: 'INT-1' } } })
  assert.equal(result.randMind.learning.status, 'OBSERVED')
  assert.equal(result.randMind.learning.hotelId, 'hotelgio')
})

test('block2: promotion is automatic only for tested low-risk improvements', () => {
  assert.equal(learningPromotionDecision({ tested: true, evidenceCount: 2, risk: 'LOW' }).mode, LearningPromotionMode.AUTO)
  assert.equal(learningPromotionDecision({ tested: true, evidenceCount: 3, risk: 'HIGH' }).mode, LearningPromotionMode.REVIEW)
  assert.equal(learningPromotionDecision({ tested: true, evidenceCount: 3, risk: 'LOW', changesAuthorization: true }).mode, LearningPromotionMode.REVIEW)
  assert.equal(learningPromotionDecision({ tested: false, evidenceCount: 10, risk: 'LOW' }).mode, LearningPromotionMode.BLOCKED)
})
