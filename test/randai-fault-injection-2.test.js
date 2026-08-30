import test from 'node:test'
import assert from 'node:assert/strict'
import { DiscoveryEngine, DiscoveryStore } from '../src/randai/discovery/index.js'
import { LearningEngine, LearningCandidateStatus } from '../src/randai/learning/index.js'
import { SkillRegistry } from '../src/randai/skills/registry.js'
import { SkillStatus } from '../src/randai/skills/contracts.js'

const sharedCandidate = { id: 'same-tool', name: 'Same Tool', kind: 'TOOL', ref: 'repo:same-tool', license: 'MIT', reputation: 0.8, maintained: true, risk: 'LOW' }

test('fault injection: discovery keeps identical candidate ids isolated by project', async () => {
  const store = new DiscoveryStore()
  const engine = new DiscoveryEngine({ sources: [{ id: 'github', search: async () => [sharedCandidate] }], store })
  await engine.discover({ query: 'tool', projectId: 'project-a' })
  await engine.discover({ query: 'tool', projectId: 'project-b' })
  const a = await store.get('same-tool', 'project-a')
  const b = await store.get('same-tool', 'project-b')
  assert.equal(a.projectId, 'project-a')
  assert.equal(b.projectId, 'project-b')
  assert.equal((await store.list({ projectId: 'project-a' })).length, 1)
  assert.equal((await store.list({ projectId: 'project-b' })).length, 1)
})

test('fault injection: one broken discovery provider cannot suppress healthy providers', async () => {
  const engine = new DiscoveryEngine({
    sources: [
      { id: 'broken', search: async () => { throw new Error('provider offline') } },
      { id: 'healthy', search: async () => [{ ...sharedCandidate, id: 'healthy-tool' }] },
    ],
  })
  const found = await engine.discover({ query: 'tool', projectId: 'randai' })
  assert.deepEqual(found.map((item) => item.id), ['healthy-tool'])
  assert.deepEqual(engine.lastSourceFailures, [{ sourceId: 'broken', message: 'provider offline' }])
})

test('fault injection: all failed discovery providers surface an aggregate failure', async () => {
  const engine = new DiscoveryEngine({ sources: [
    { id: 'one', search: async () => { throw new Error('one down') } },
    { id: 'two', search: async () => { throw new Error('two down') } },
  ] })
  await assert.rejects(() => engine.discover({ query: 'tool' }), AggregateError)
})

test('fault injection: learning evaluation crash cannot leave candidate EVALUATING or skill executable', async () => {
  const learning = new LearningEngine({ minEvidence: 2 })
  const registry = new SkillRegistry()
  const base = { problemClass: 'unstable-eval', strategy: 'verified repair', tools: ['repo.read'], verified: true }
  await learning.observe({ ...base, source: { kind: 'task', id: 'a' }, metadata: { taskId: 'a' } })
  const candidate = await learning.observe({ ...base, source: { kind: 'task', id: 'b' }, metadata: { taskId: 'b' } })
  await learning.proposeSkill(candidate.id, { skillRegistry: registry, id: 'unstable-eval-skill', name: 'Unstable Eval Skill', description: 'Regression test skill' })
  const evaluationEngine = { runScenario: async () => { throw new Error('evaluator crashed') } }
  await assert.rejects(() => learning.evaluate(candidate.id, { evaluationEngine, scenario: { id: 'boom' }, skillRegistry: registry }), /evaluator crashed/)
  const persisted = await learning.store.get(candidate.id)
  assert.equal(persisted.status, LearningCandidateStatus.REJECTED)
  assert.match(persisted.evaluationError.message, /evaluator crashed/)
  assert.equal(registry.inspect('unstable-eval-skill', '0.1.0').status, SkillStatus.BLOCKED)
})
