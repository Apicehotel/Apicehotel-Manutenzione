import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryEngine, MemoryStore, MemoryType, MemoryTrust } from '../src/randai/memory/index.js'
import { ContextEngine } from '../src/randai/context/index.js'

const source = (id) => ({ kind: 'test', id })

test('memory persists across engine instances and preserves provenance', async () => {
  const store = new MemoryStore()
  const first = new MemoryEngine({ store })
  const saved = await first.remember({ type: MemoryType.SEMANTIC, scope: 'hotel', hotelId: 'hotelgio', trust: MemoryTrust.APPROVED, content: 'La valvola generale acqua Jazz è nel locale tecnico -1', summary: 'Valvola generale acqua Jazz: locale tecnico -1', source: source('procedure-42'), importance: 0.95, confidence: 1 })
  const second = new MemoryEngine({ store })
  const recalled = await second.recall('dove si trova valvola acqua jazz', { hotelId: 'hotelgio', trust: ['approved'] })
  assert.equal(recalled[0].id, saved.id)
  assert.deepEqual(recalled[0].source, source('procedure-42'))
})

test('hotel scope prevents cross-hotel recall', async () => {
  const store = new MemoryStore(); const engine = new MemoryEngine({ store })
  await engine.remember({ type: MemoryType.SEMANTIC, scope: 'hotel', hotelId: 'hotelgio', trust: MemoryTrust.APPROVED, content: 'quadro ascensore jazz locale tecnico', source: source('a') })
  assert.equal((await engine.recall('quadro ascensore jazz', { hotelId: 'choco' })).length, 0)
})

test('context engine respects token budget and keeps provenance', async () => {
  const store = new MemoryStore(); const memoryEngine = new MemoryEngine({ store })
  await memoryEngine.remember({ type: MemoryType.PROJECT, scope: 'project', projectId: 'randai', trust: MemoryTrust.VERIFIED, content: 'Auth RandAI usa Supabase session validation e login PIN', summary: 'Auth RandAI: Supabase session + PIN', source: source('commit-auth'), importance: 0.9, confidence: 1 })
  await memoryEngine.remember({ type: MemoryType.PROJECT, scope: 'project', projectId: 'randai', trust: MemoryTrust.SUGGESTED, content: 'Testo irrilevante molto lungo '.repeat(100), source: source('noise'), importance: 0.1, confidence: 0.2 })
  const context = await new ContextEngine({ memoryEngine, defaultBudget: 80 }).build({ query: 'login auth RandAI Supabase', projectId: 'randai' })
  assert.ok(context.usedTokens <= 80)
  assert.equal(context.sections[0].source.id, 'commit-auth')
  assert.equal(context.provenance[0].memoryId, context.sections[0].id)
})

test('completed durable task becomes episodic and procedural memory', async () => {
  const store = new MemoryStore(); const engine = new MemoryEngine({ store })
  const memories = await engine.extractFromTask({ id: 'RND-1', objective: 'Fix auth', status: 'SUCCEEDED', metadata: {}, decisions: [{ type: 'STRATEGY_CHANGE', reason: 'fallback worked' }] })
  assert.equal(memories.length, 2)
  assert.equal(memories[0].type, MemoryType.EPISODIC)
  assert.equal(memories[1].type, MemoryType.PROCEDURAL)
  assert.equal(memories[1].trust, MemoryTrust.VERIFIED)
})

test('expired memory is ignored and near-duplicate can be detected', async () => {
  const store = new MemoryStore(); const engine = new MemoryEngine({ store })
  await engine.remember({ type: MemoryType.CONVERSATIONAL, scope: 'global', trust: MemoryTrust.DRAFT, content: 'usa sempre build e test prima del merge', source: source('chat-1'), expiresAt: '2020-01-01T00:00:00Z' })
  assert.equal((await engine.recall('build test merge')).length, 0)
  await engine.remember({ type: MemoryType.PROCEDURAL, scope: 'global', trust: MemoryTrust.VERIFIED, content: 'build test merge', source: source('chat-2') })
  assert.ok(await engine.deduplicate({ content: 'build test merge' }))
})
