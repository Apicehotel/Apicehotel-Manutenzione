import test from 'node:test'
import assert from 'node:assert/strict'
import { DiscoveryDisposition, DiscoveryEngine, DiscoveryStatus, DiscoveryStore, classifyDiscoveryDisposition } from '../src/randai/discovery/index.js'

const candidate = (overrides = {}) => ({
  id: 'candidate',
  name: 'Candidate',
  kind: 'TOOL',
  source: { id: 'github', ref: 'github:candidate' },
  status: DiscoveryStatus.RECOMMENDED,
  ...overrides,
})

test('discovery classifies a safe evaluated candidate as ADD', () => {
  assert.equal(classifyDiscoveryDisposition({ candidate: candidate() }), DiscoveryDisposition.ADD)
  assert.equal(classifyDiscoveryDisposition({ candidate: candidate({ status: DiscoveryStatus.REJECTED }) }), DiscoveryDisposition.IGNORE)
})

test('discovery permits REPLACE only with an existing target and evidence of superiority', () => {
  const existing = [{ id: 'old-tool', name: 'Old tool' }]
  assert.equal(classifyDiscoveryDisposition({
    candidate: candidate({ evaluation: { replaces: 'old-tool', superior: true } }),
    existingCandidates: existing,
  }), DiscoveryDisposition.REPLACE)
  assert.equal(classifyDiscoveryDisposition({
    candidate: candidate({ evaluation: { replaces: 'old-tool', superior: false } }),
    existingCandidates: existing,
  }), DiscoveryDisposition.IGNORE)
  assert.equal(classifyDiscoveryDisposition({
    candidate: candidate({ evaluation: { replaces: 'missing', superior: true } }),
    existingCandidates: existing,
  }), DiscoveryDisposition.IGNORE)
})

test('discovery engine records disposition without installing candidates', async () => {
  const engine = new DiscoveryEngine({
    store: new DiscoveryStore(),
    sources: [{
      id: 'github',
      search: async () => [{ ...candidate(), reputation: 0.9, license: 'MIT', maintained: true, risk: 'LOW' }],
    }],
    analyzer: async () => ({ risk: 'LOW' }),
    sandbox: async () => ({ passed: true, isolated: true }),
    evaluator: async () => ({ utilityScore: 0.95, securityScore: 0.99 }),
  })
  await engine.discover({ query: 'safe tool' })
  await engine.assess('candidate')
  await engine.sandboxCandidate('candidate')
  const result = await engine.evaluateCandidate('candidate')
  assert.equal(result.disposition, DiscoveryDisposition.ADD)
  assert.equal(typeof engine.install, 'undefined')
})
