import test from 'node:test'
import assert from 'node:assert/strict'
import { DiscoveryEngine, DiscoveryStatus, DiscoveryStore } from '../src/randai/discovery/index.js'
import { RandAISupervisor, SupervisorMode, SupervisorStatus, SupervisorStopReason, SupervisorStore } from '../src/randai/supervisor/index.js'

function source() {
  return {
    id: 'github',
    async search() {
      return [
        { id: 'popular-risky', name: 'Popular risky skill', kind: 'SKILL', ref: 'github:popular-risky', license: 'MIT', reputation: 0.99, maintained: true, risk: 'MEDIUM' },
        { id: 'safe-small', name: 'Safe small skill', kind: 'SKILL', ref: 'github:safe-small', license: 'MIT', reputation: 0.55, maintained: true, risk: 'LOW' },
      ]
    },
  }
}

test('discovery rejects suspicious popular candidate and recommends safe evaluated candidate without installing it', async () => {
  const engine = new DiscoveryEngine({
    sources: [source()],
    analyzer: async (candidate) => candidate.id === 'popular-risky' ? { suspicious: true, secretAccess: true, risk: 'CRITICAL' } : { suspicious: false, risk: 'LOW' },
    sandbox: async (candidate) => ({ passed: candidate.id === 'safe-small', isolated: true, network: 'blocked' }),
    evaluator: async () => ({ utilityScore: 0.9, securityScore: 0.98 }),
  })
  const found = await engine.discover({ query: 'safe github helper', projectId: 'randai' })
  assert.equal(found.length, 2)
  const risky = await engine.assess('popular-risky')
  assert.equal(risky.candidate.status, DiscoveryStatus.REJECTED)
  const safe = await engine.assess('safe-small')
  assert.equal(safe.candidate.status, DiscoveryStatus.ANALYZED)
  await engine.sandboxCandidate('safe-small')
  const evaluated = await engine.evaluateCandidate('safe-small')
  assert.equal(evaluated.status, DiscoveryStatus.RECOMMENDED)
  assert.equal((await engine.recommendations({ projectId: 'randai' }))[0].id, 'safe-small')
  assert.equal(typeof engine.install, 'undefined')
})

test('discovery store isolates projects', async () => {
  const store = new DiscoveryStore()
  await store.save({ id: 'a', projectId: 'one', status: 'DISCOVERED', kind: 'TOOL' })
  await store.save({ id: 'b', projectId: 'two', status: 'DISCOVERED', kind: 'TOOL' })
  assert.deepEqual((await store.list({ projectId: 'one' })).map((item) => item.id), ['a'])
})

test('supervisor chooses multi-agent only for explicitly decomposed work and enforces preflight agent budget', () => {
  const supervisor = new RandAISupervisor({ defaultBudget: { maxAgents: 2 } })
  assert.equal(supervisor.plan({ objective: 'small fix', agentTasks: [{ id: 'one' }] }).mode, SupervisorMode.SINGLE_AGENT)
  assert.equal(supervisor.plan({ objective: 'complex but not decomposed', complexity: 'HIGH' }).mode, SupervisorMode.SINGLE_AGENT)
  assert.equal(supervisor.plan({ objective: 'broad audit', complexity: 'HIGH', agentTasks: [{ id: 'a' }, { id: 'b' }] }).mode, SupervisorMode.MULTI_AGENT)
  const stopped = supervisor.plan({ objective: 'too broad', complexity: 'HIGH', agentTasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] })
  assert.equal(stopped.mode, SupervisorMode.STOPPED)
  assert.equal(stopped.reason, SupervisorStopReason.BUDGET_EXCEEDED)
})

test('supervisor blocks capability gaps and discovers candidates without installation', async () => {
  const discovery = new DiscoveryEngine({ sources: [source()] })
  const supervisor = new RandAISupervisor({ discovery })
  const run = await supervisor.run({ objective: 'use missing capability', capabilityGaps: ['safe github helper'], projectId: 'randai' })
  assert.equal(run.status, SupervisorStatus.BLOCKED)
  assert.equal(run.mode, SupervisorMode.DISCOVERY_REQUIRED)
  assert.equal(run.stopReason, SupervisorStopReason.CAPABILITY_GAP)
  assert.equal(run.recommendations.length, 2)
  assert.ok(run.recommendations.every((item) => item.status === DiscoveryStatus.DISCOVERED))
})

test('supervisor enforces runtime budget and quality gate', async () => {
  const supervisor = new RandAISupervisor({ qualityThreshold: 0.85, defaultBudget: { maxToolCalls: 3 } })
  const overBudget = await supervisor.run({ objective: 'task', executeSingle: async () => ({ ok: true, metrics: { toolCalls: 4 }, qualityScore: 1 }) })
  assert.equal(overBudget.status, SupervisorStatus.STOPPED)
  assert.equal(overBudget.stopReason, SupervisorStopReason.BUDGET_EXCEEDED)

  const lowQuality = await supervisor.run({ objective: 'task', executeSingle: async () => ({ ok: true, metrics: { toolCalls: 1 }, qualityScore: 0.7 }) })
  assert.equal(lowQuality.status, SupervisorStatus.NEEDS_REVIEW)
  assert.equal(lowQuality.stopReason, SupervisorStopReason.QUALITY_GATE)
})

test('supervisor global anti-loop stops repeated failure fingerprints', () => {
  const supervisor = new RandAISupervisor({ repeatedFailureLimit: 3 })
  assert.equal(supervisor.recordFailure({ fingerprint: 'same' }).stop, false)
  assert.equal(supervisor.recordFailure({ fingerprint: 'same' }).stop, false)
  const third = supervisor.recordFailure({ fingerprint: 'same' })
  assert.equal(third.stop, true)
  assert.equal(third.reason, SupervisorStopReason.REPEATED_FAILURE)
})

test('supervisor persists runs with project isolation', async () => {
  const store = new SupervisorStore()
  const supervisor = new RandAISupervisor({ store })
  await supervisor.run({ objective: 'one', projectId: 'one', executeSingle: async () => ({ ok: true, qualityScore: 1 }) })
  await supervisor.run({ objective: 'two', projectId: 'two', executeSingle: async () => ({ ok: true, qualityScore: 1 }) })
  assert.equal((await store.list({ projectId: 'one' })).length, 1)
})
