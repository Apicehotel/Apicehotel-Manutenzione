import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAgentPolicyError, RandAgentRuntime } from '../src/randai/agents/orchestration.js'
import { MemoryStore, RandMind, RandMindContinuity, RandContinuityError } from '../src/randai/memory/index.js'
import { ModelCapability, ModelRouter, PrivacyLevel, RoutingPriority, RoutingRisk } from '../src/randai/models/index.js'

const executor = (impl = async () => ({ ok: true, summary: 'verified execution' })) => ({ run: impl })

function createMind() {
  const store = new MemoryStore()
  return { store, randMind: new RandMind({ store }) }
}

function createModel(id, { quality, reliability, cost, privacy = PrivacyLevel.SENSITIVE, capabilities = [ModelCapability.REASONING] }) {
  return {
    id,
    provider: 'test',
    capabilities,
    quality,
    reliability,
    cost,
    latency: 0.4,
    privacy,
    contextWindow: 100000,
  }
}

test('RandMind continuity carries verified outcome from web to WhatsApp with same continuityId', async () => {
  const { randMind } = createMind()
  const continuity = new RandMindContinuity({ randMind })
  const seen = []
  const runtime = new RandAgentRuntime({
    executor: executor(),
    continuity,
    planner: async ({ context, channel }) => {
      seen.push({ channel, continuityId: context.continuityId, memories: context.randContinuity?.memories || [] })
      return { tasks: [] }
    },
    inspector: async () => ({ ok: true, summary: 'ascensore controllato' }),
  })

  const first = await runtime.run({
    objective: 'controlla ascensore',
    context: { hotelId: 'hotelgio', actor: { id: 'u-1' } },
    channel: 'web',
    runId: 'run-web',
  })
  const continuityId = first.continuity.state.continuityId
  assert.match(continuityId, /^CONT-/)
  assert.equal(first.continuity.commit.saved, true)

  const second = await runtime.run({
    objective: 'riprendi controllo ascensore',
    context: { hotelId: 'hotelgio', actor: { id: 'u-1' }, continuityId },
    channel: 'whatsapp',
    runId: 'run-wa',
  })
  assert.equal(second.ok, true)
  assert.equal(seen[1].channel, 'whatsapp')
  assert.equal(seen[1].continuityId, continuityId)
  assert.equal(seen[1].memories.length, 1)
  assert.match(seen[1].memories[0].content, /controlla ascensore/i)
})

test('continuity is hotel-scoped: same external id cannot read another hotel history', async () => {
  const { randMind } = createMind()
  const continuity = new RandMindContinuity({ randMind })
  const first = await continuity.open({ context: { hotelId: 'hotelgio', actor: { id: 'u-1' } }, runId: 'r1' })
  await continuity.commit({
    objective: 'hotel gio operation',
    context: { hotelId: 'hotelgio', actor: { id: 'u-1' }, continuityId: first.identity.continuityId },
    runId: 'r1',
    execution: { ok: true },
    inspection: { ok: true },
  })
  const other = await continuity.open({
    context: { hotelId: 'chocohotel', actor: { id: 'u-1' }, continuityId: first.identity.continuityId },
    runId: 'r2',
  })
  assert.equal(other.context.randContinuity.memories.length, 0)
})

test('continuity rejects a different actor when history is actor-bound', async () => {
  const { randMind } = createMind()
  const continuity = new RandMindContinuity({ randMind })
  const opened = await continuity.open({ context: { hotelId: 'hotelgio', actor: { id: 'u-1' } }, runId: 'r1' })
  await continuity.commit({
    objective: 'private operation',
    context: { hotelId: 'hotelgio', actor: { id: 'u-1' }, continuityId: opened.identity.continuityId },
    runId: 'r1',
    execution: { ok: true },
    inspection: { ok: true },
  })
  await assert.rejects(
    () => continuity.open({ context: { hotelId: 'hotelgio', actor: { id: 'u-2' }, continuityId: opened.identity.continuityId }, runId: 'r2' }),
    (error) => error instanceof RandContinuityError && error.code === 'RAND_CONTINUITY_ACTOR_MISMATCH',
  )
})

test('continuity requires explicit hotel scope and never falls back to global recall', async () => {
  const { randMind } = createMind()
  const continuity = new RandMindContinuity({ randMind })
  await assert.rejects(
    () => continuity.open({ context: {}, runId: 'r1' }),
    (error) => error instanceof RandContinuityError && error.code === 'RAND_CONTINUITY_HOTEL_REQUIRED',
  )
})

test('runtime refuses a context provider that changes an existing hotel scope', async () => {
  const runtime = new RandAgentRuntime({
    executor: executor(),
    planner: async () => ({ tasks: [] }),
    contextProvider: async () => ({ hotelId: 'chocohotel' }),
  })
  await assert.rejects(
    () => runtime.run({ objective: 'scope test', context: { hotelId: 'hotelgio' }, runId: 'scope-run' }),
    (error) => error instanceof RandAgentPolicyError && /hotel scope/i.test(error.message),
  )
})

test('continuity commit failure is observable but does not turn successful operational work into a failure', async () => {
  const continuity = {
    open: async () => ({ context: { continuityId: 'CONT-test', randContinuity: { continuityId: 'CONT-test', memoryIds: [] } }, state: { continuityId: 'CONT-test' } }),
    commit: async () => { throw new Error('memory store offline') },
  }
  const runtime = new RandAgentRuntime({
    executor: executor(),
    continuity,
    planner: async () => ({ tasks: [] }),
    inspector: async () => ({ ok: true }),
  })
  const result = await runtime.run({ objective: 'safe work', context: { hotelId: 'hotelgio' }, runId: 'commit-fail' })
  assert.equal(result.ok, true)
  assert.equal(result.continuity.commit.saved, false)
  assert.equal(result.continuity.commit.reason, 'COMMIT_FAILED')
  assert.equal(result.trace.some((event) => event.type === 'RAND_AGENT_CONTINUITY_COMMIT_FAILED'), true)
})

test('high-risk routing filters cheap weak models even when COST priority is requested', () => {
  const router = new ModelRouter({ models: [
    createModel('cheap', { quality: 0.55, reliability: 0.6, cost: 0.1 }),
    createModel('strong', { quality: 0.9, reliability: 0.95, cost: 0.75 }),
  ] })
  const route = router.route({
    requiredCapabilities: [ModelCapability.REASONING],
    privacy: PrivacyLevel.SENSITIVE,
    risk: RoutingRisk.HIGH,
    priority: RoutingPriority.COST,
  })
  assert.equal(route.selected.id, 'strong')
  assert.equal(route.constraints.minQuality, 0.7)
  assert.equal(route.constraints.minReliability, 0.75)
})

test('critical routing fails closed when no model reaches the critical reliability floor', () => {
  const router = new ModelRouter({ models: [
    createModel('almost', { quality: 0.95, reliability: 0.89, cost: 0.4 }),
  ] })
  const route = router.route({ risk: RoutingRisk.CRITICAL, requiredCapabilities: [ModelCapability.REASONING] })
  assert.equal(route.selected, null)
  assert.equal(route.reason, 'NO_COMPATIBLE_MODEL')
  assert.equal(route.constraints.minReliability, 0.9)
})

test('model routing honors an explicit normalized cost ceiling', () => {
  const router = new ModelRouter({ models: [
    createModel('expensive', { quality: 0.95, reliability: 0.98, cost: 0.9 }),
    createModel('within-budget', { quality: 0.82, reliability: 0.9, cost: 0.45 }),
  ] })
  const route = router.route({
    risk: RoutingRisk.MEDIUM,
    maxCost: 0.5,
    requiredCapabilities: [ModelCapability.REASONING],
  })
  assert.equal(route.selected.id, 'within-budget')
})

test('fallback execution never escapes the governed candidate set', async () => {
  const router = new ModelRouter({ models: [
    createModel('primary', { quality: 0.95, reliability: 0.98, cost: 0.6 }),
    createModel('fallback', { quality: 0.9, reliability: 0.95, cost: 0.55 }),
    createModel('unsafe-cheap', { quality: 0.4, reliability: 0.4, cost: 0.05 }),
  ] })
  const result = await router.execute(
    { risk: RoutingRisk.HIGH, requiredCapabilities: [ModelCapability.REASONING] },
    async (model) => {
      if (model.id === 'primary') throw new Error('transient')
      return model.id
    },
  )
  assert.equal(result.ok, true)
  assert.equal(result.result, 'fallback')
  assert.deepEqual(result.attempts.map((attempt) => attempt.modelId), ['primary', 'fallback'])
})
