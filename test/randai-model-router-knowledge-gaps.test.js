import test from 'node:test'
import assert from 'node:assert/strict'
import { ModelRouter, ModelCapability, PrivacyLevel, RoutingPriority } from '../src/randai/models/index.js'
import { KnowledgeGapEngine, KnowledgeGapStore, GapScope, GapStatus } from '../src/randai/gaps/index.js'
import { MaintenanceKnowledgeEngine, KnowledgeTrust } from '../src/randai/maintenance/index.js'

const models = [
  { id: 'fast', provider: 'demo', capabilities: [ModelCapability.FAST], privacy: PrivacyLevel.STANDARD, quality: 0.5, reliability: 0.95, cost: 0.1, latency: 0.1, contextWindow: 100000 },
  { id: 'reasoning', provider: 'demo', capabilities: [ModelCapability.REASONING, ModelCapability.CODING, ModelCapability.VISION], privacy: PrivacyLevel.SENSITIVE, quality: 0.98, reliability: 0.95, cost: 0.9, latency: 0.7, contextWindow: 1000000 },
  { id: 'balanced', provider: 'demo', capabilities: [ModelCapability.REASONING, ModelCapability.CODING], privacy: PrivacyLevel.SENSITIVE, quality: 0.85, reliability: 0.98, cost: 0.4, latency: 0.35, contextWindow: 500000 },
  { id: 'local', provider: 'local', capabilities: [ModelCapability.FAST, ModelCapability.LOCAL], privacy: PrivacyLevel.LOCAL_ONLY, quality: 0.45, reliability: 0.9, cost: 0.05, latency: 0.2, contextWindow: 64000 },
]

test('model router excludes incompatible models and explains route', () => {
  const router = new ModelRouter({ models })
  const route = router.route({ requiredCapabilities: [ModelCapability.CODING], minContextWindow: 200000, privacy: PrivacyLevel.SENSITIVE, priority: RoutingPriority.BALANCED })
  assert.equal(route.reason, 'BEST_COMPATIBLE_MODEL')
  assert.ok(['reasoning', 'balanced'].includes(route.selected.id))
  assert.ok(route.fallbacks.every((model) => model.capabilities.includes(ModelCapability.CODING)))
  assert.ok(route.fallbacks.every((model) => model.contextWindow >= 200000))
})

test('privacy requirement can force local-only routing', () => {
  const router = new ModelRouter({ models })
  const route = router.route({ requiredCapabilities: [ModelCapability.FAST], privacy: PrivacyLevel.LOCAL_ONLY })
  assert.equal(route.selected.id, 'local')
})

test('model router performs bounded fallback and records attempts', async () => {
  const router = new ModelRouter({ models })
  const result = await router.execute({ requiredCapabilities: [ModelCapability.CODING], priority: RoutingPriority.QUALITY }, async (model) => {
    if (model.id === 'reasoning') throw new Error('provider unavailable')
    return `ok:${model.id}`
  }, { maxFallbacks: 1 })
  assert.equal(result.ok, true)
  assert.deepEqual(result.attempts.map((item) => item.status), ['FAILED', 'SUCCESS'])
  assert.equal(result.result, 'ok:balanced')
})

test('model router rejects duplicate or invalid descriptors and execution limits', async () => {
  const router = new ModelRouter({ models: [models[0]] })
  assert.throws(() => router.register(models[0]), /already registered/)
  assert.throws(() => router.register({ id: 'bad', provider: 'demo', capabilities: [ModelCapability.FAST], quality: Number.NaN }), /quality/)
  assert.throws(() => router.route({ minContextWindow: -1 }), /minContextWindow/)
  await assert.rejects(() => router.execute({}, async () => 'ok', { maxFallbacks: -1 }), /maxFallbacks/)
})

test('unknown maintenance lookup creates one hotel-scoped knowledge gap without guessing', async () => {
  const knowledge = new MaintenanceKnowledgeEngine()
  const result = knowledge.search({ hotelId: 'hotelgio', query: 'dove si trova valvola acqua piano 4 wine' })
  assert.equal(result.found, false)
  assert.equal(result.trust, KnowledgeTrust.UNKNOWN)

  const gaps = new KnowledgeGapEngine({ store: new KnowledgeGapStore() })
  const first = await gaps.captureUnknown(result, { question: result.query, hotelId: 'hotelgio', entityType: 'valve', entityId: 'wine-floor-4-water' })
  const second = await gaps.captureUnknown(result, { question: result.query, hotelId: 'hotelgio', entityType: 'valve', entityId: 'wine-floor-4-water' })
  assert.equal(first.captured, true)
  assert.equal(first.gap.status, GapStatus.OPEN)
  assert.equal(first.gap.hotelId, 'hotelgio')
  assert.equal(first.gap.proposedAnswer, null)
  assert.equal(second.created, false)
  assert.equal((await gaps.list({ hotelId: 'hotelgio', scope: GapScope.MAINTENANCE })).length, 1)
  assert.equal((await gaps.list({ hotelId: 'choco', scope: GapScope.MAINTENANCE })).length, 0)
})

test('a proposed answer cannot silently resolve a gap without explicit approval and provenance', async () => {
  const gaps = new KnowledgeGapEngine({ store: new KnowledgeGapStore() })
  const { gap } = await gaps.open({ scope: GapScope.PROJECT, projectId: 'randai', question: 'Quale servizio possiede il model gateway?' })
  const proposed = await gaps.propose(gap.id, { answer: 'Potrebbe essere il runtime RandAI', source: { kind: 'ai_suggestion', id: 'suggestion-1' } })
  assert.equal(proposed.status, GapStatus.PROPOSED)
  await assert.rejects(() => gaps.resolve(gap.id, { source: { kind: 'commit', id: 'abc' } }), /explicit approval/)
  const resolved = await gaps.resolve(gap.id, { source: { kind: 'commit', id: 'abc' }, approved: true })
  assert.equal(resolved.status, GapStatus.RESOLVED)
  assert.deepEqual(resolved.resolutionSource, { kind: 'commit', id: 'abc' })
})
