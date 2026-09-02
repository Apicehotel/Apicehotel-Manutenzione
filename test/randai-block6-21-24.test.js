import test from 'node:test'
import assert from 'node:assert/strict'

import { SoftwareEngineeringAgent } from '../src/randai/software/index.js'
import { LearningEngine, LearningStore } from '../src/randai/learning/index.js'
import { SkillRegistry } from '../src/randai/skills/registry.js'
import { DiscoveryEngine } from '../src/randai/discovery/index.js'
import { RandAISupervisor, SupervisorStatus, SupervisorStore } from '../src/randai/supervisor/index.js'

const plan = { id: 'p', steps: [{ id: 's', title: 'step', strategies: [{ toolId: 'test.run', input: {} }] }] }

test('block 6 / point 21: software analysis rejects duplicate targets and cross-hotel impact', async () => {
  const agent = new SoftwareEngineeringAgent({
    projectIntelligence: { impact: async () => ({ hotelId: 'chocohotel', affected: [] }) },
    durableRunner: {},
  })
  await assert.rejects(() => agent.analyze({ objective: 'x', targetNodeIds: ['a', 'a'], proposedPlan: plan }), /unique/)
  await assert.rejects(() => agent.analyze({ objective: 'x', targetNodeIds: ['a'], proposedPlan: plan, metadata: { hotelId: 'hotelgio' } }), /hotel scope mismatch/)
})

test('block 6 / point 21: software execution keeps observability failures non-fatal', async () => {
  const agent = new SoftwareEngineeringAgent({
    projectIntelligence: { impact: async () => ({ affected: [] }) },
    durableRunner: {
      create: async ({ metadata }) => ({ id: 'task', metadata }),
      resume: async () => ({ id: 'task', status: 'SUCCEEDED' }),
    },
    reviewer: { review: async () => ({ ok: true }) },
    observability: {
      startTrace: async () => ({ id: 'trace' }),
      emit: async () => { throw new Error('telemetry unavailable') },
      completeTrace: async () => { throw new Error('telemetry unavailable') },
    },
  })
  const spec = await agent.analyze({ objective: 'safe change', proposedPlan: plan, metadata: { hotelId: 'hotelgio' } })
  const result = await agent.execute(spec)
  assert.equal(result.status, 'SUCCEEDED')
})

test('block 6 / point 22: hotel-scoped learning candidates cannot be proposed or evaluated without matching scope', async () => {
  const store = new LearningStore()
  const learning = new LearningEngine({ store, minEvidence: 2 })
  const base = { hotelId: 'hotelgio', problemClass: 'filter', strategy: 'fix safely', tools: ['test.run'], verified: true }
  await learning.observe({ ...base, source: { kind: 'task', id: 'a' }, metadata: { taskId: 'a' } })
  const candidate = await learning.observe({ ...base, source: { kind: 'task', id: 'b' }, metadata: { taskId: 'b' } })
  const registry = new SkillRegistry()
  const args = { skillRegistry: registry, id: 'safe-filter', name: 'Safe filter', description: 'Verified filter repair' }
  await assert.rejects(() => learning.proposeSkill(candidate.id, args), /out-of-scope/)
  await assert.rejects(() => learning.proposeSkill(candidate.id, { ...args, hotelId: 'chocohotel' }), /out-of-scope/)
  const proposal = await learning.proposeSkill(candidate.id, { ...args, hotelId: 'hotelgio' })
  assert.equal(proposal.candidate.hotelId, 'hotelgio')
})

test('block 6 / point 22: invalid learning evidence threshold fails fast', () => {
  assert.throws(() => new LearningEngine({ minEvidence: Number.NaN }), /minEvidence/)
  assert.throws(() => new LearningEngine({ minEvidence: 1 }), /minEvidence/)
})

test('block 6 / point 23: discovery rejects duplicate sources and candidate ids across providers', async () => {
  const one = { id: 'one', search: async () => [{ id: 'same', name: 'One', kind: 'TOOL', ref: 'one:same', license: 'MIT', reputation: 0.5 }] }
  assert.throws(() => new DiscoveryEngine({ sources: [one, one] }), /already registered/)
  const engine = new DiscoveryEngine({ sources: [one, { id: 'two', search: async () => [{ id: 'same', name: 'Two', kind: 'TOOL', ref: 'two:same', license: 'MIT', reputation: 0.5 }] }] })
  await assert.rejects(() => engine.discover({ query: 'helper' }), /Duplicate discovery candidate id/)
})

test('block 6 / point 23: discovery rejects malformed evaluation scores instead of persisting NaN', async () => {
  const engine = new DiscoveryEngine({
    sources: [{ id: 'one', search: async () => [{ id: 'x', name: 'X', kind: 'TOOL', ref: 'one:x', license: 'MIT', reputation: 0.5 }] }],
    analyzer: async () => ({ risk: 'LOW' }),
    sandbox: async () => ({ passed: true }),
    evaluator: async () => ({ utilityScore: Number.NaN, securityScore: 1 }),
  })
  await engine.discover({ query: 'x' })
  await engine.assess('x')
  await engine.sandboxCandidate('x')
  await assert.rejects(() => engine.evaluateCandidate('x'), /utilityScore/)
})

test('block 6 / point 24: supervisor runs and anti-loop are isolated by hotel', async () => {
  const store = new SupervisorStore()
  const supervisor = new RandAISupervisor({ store, repeatedFailureLimit: 2 })
  await supervisor.run({ objective: 'gio', hotelId: 'hotelgio', executeSingle: async () => ({ ok: true, qualityScore: 1 }) })
  await supervisor.run({ objective: 'choco', hotelId: 'chocohotel', executeSingle: async () => ({ ok: true, qualityScore: 1 }) })
  assert.equal((await store.list({ hotelId: 'hotelgio' })).length, 1)
  assert.equal((await store.list({ hotelId: 'chocohotel' })).length, 1)
  assert.equal(supervisor.recordFailure({ fingerprint: 'same', hotelId: 'hotelgio' }).stop, false)
  assert.equal(supervisor.recordFailure({ fingerprint: 'same', hotelId: 'hotelgio' }).stop, true)
  assert.equal(supervisor.recordFailure({ fingerprint: 'same', hotelId: 'chocohotel' }).stop, false)
})

test('block 6 / point 24: telemetry failures do not fail successful supervised work', async () => {
  const diagnostics = []
  const supervisor = new RandAISupervisor({
    eventSink: async () => { throw new Error('telemetry down') },
    onTelemetryError: async ({ error }) => diagnostics.push(error.message),
  })
  const run = await supervisor.run({ objective: 'safe', hotelId: 'hotelgio', executeSingle: async () => ({ ok: true, qualityScore: 1, metrics: { toolCalls: 1 } }) })
  assert.equal(run.status, SupervisorStatus.SUCCEEDED)
  assert.ok(diagnostics.length > 0)
})

test('block 6 / point 24: invalid thresholds budgets and metrics fail closed', async () => {
  assert.throws(() => new RandAISupervisor({ qualityThreshold: Number.NaN }), /qualityThreshold/)
  assert.throws(() => new RandAISupervisor({ defaultBudget: { maxAgents: 2, maxConcurrency: 3 } }), /maxConcurrency/)
  const supervisor = new RandAISupervisor()
  const run = await supervisor.run({ objective: 'bad metrics', executeSingle: async () => ({ ok: true, qualityScore: 1, metrics: { toolCalls: Number.NaN } }) })
  assert.equal(run.status, SupervisorStatus.FAILED)
})
