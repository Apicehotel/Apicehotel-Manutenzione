import test from 'node:test'
import assert from 'node:assert/strict'
import {
  KnowledgeBackend,
  KnowledgeRole,
  RandKnowledgeGateway,
  authorizeKnowledgeQuery,
  knowledgeBackendPolicy,
  normalizeKnowledgeHit,
} from '../src/randai/core/knowledge-gateway.js'

const actor = { id: 'tester' }
const access = { actor, hotelId: 'gio', grantedScopes: ['knowledge:read'] }

function memory(overrides = {}) {
  return {
    id: 'm1',
    hotelId: 'gio',
    content: 'Motore ventilconvettore 1101 verificato funzionante',
    source: { kind: 'intervention', id: 'INT-1' },
    confidence: 0.95,
    quality: { usable: true, score: 96 },
    validFrom: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

test('Group 2: knowledge query is fail-closed on identity, hotel and scope', () => {
  assert.equal(authorizeKnowledgeQuery({ hotelId: 'gio', grantedScopes: ['knowledge:read'] }).code, 'ACTOR_REQUIRED')
  assert.equal(authorizeKnowledgeQuery({ actor, hotelId: 'gio', targetHotelId: 'choco', grantedScopes: ['knowledge:read'] }).code, 'CROSS_HOTEL_DENIED')
  assert.equal(authorizeKnowledgeQuery({ actor, hotelId: 'gio', grantedScopes: [] }).code, 'SCOPE_DENIED')
  assert.equal(authorizeKnowledgeQuery(access).code, 'ALLOW')
})

test('Group 2: backend ownership is explicit and projections are rebuildable', () => {
  const policy = knowledgeBackendPolicy()
  const mind = policy.find((item) => item.backend === KnowledgeBackend.RANDMIND)
  const graph = policy.find((item) => item.backend === KnowledgeBackend.GRAPHITI)
  const rag = policy.find((item) => item.backend === KnowledgeBackend.LIGHTRAG)
  assert.equal(mind.authoritative, true)
  assert.equal(graph.role, KnowledgeRole.TEMPORAL_PROJECTION)
  assert.equal(rag.role, KnowledgeRole.RETRIEVAL_PROJECTION)
  assert.equal(graph.rebuildable, true)
  assert.equal(rag.rebuildable, true)
})

test('Group 2: projection hits require canonical provenance and exact hotel scope', () => {
  assert.throws(() => normalizeKnowledgeHit({
    backend: 'graphiti', hotelId: 'gio', content: 'relazione', source: { kind: 'edge', id: 'e1' },
  }, { hotelId: 'gio' }), /canonicalRef/)

  assert.throws(() => normalizeKnowledgeHit({
    backend: 'lightrag', hotelId: 'choco', content: 'documento', source: { kind: 'chunk', id: 'c1' }, canonicalRef: { kind: 'procedure', id: 'p1' },
  }, { hotelId: 'gio' }), /hotel scope mismatch/)
})

test('Group 2: temporal validity is enforced before context reaches RandAI', () => {
  assert.throws(() => normalizeKnowledgeHit({
    backend: 'graphiti', hotelId: 'gio', content: 'vecchia relazione', source: { kind: 'edge', id: 'e1' },
    canonicalRef: { kind: 'intervention', id: 'INT-1' }, validUntil: '2026-09-02T00:00:00.000Z',
  }, { hotelId: 'gio', at: '2026-09-03T00:00:00.000Z' }), /validity window/)
})

test('Group 2: gateway combines RandMind, temporal graph and RAG without letting projections become authority', async () => {
  const mind = { recall: async () => [memory()] }
  const graphAdapter = { query: async () => [{
    id: 'g1', hotelId: 'gio', content: 'Motore collegato alla camera 1101', source: { kind: 'edge', id: 'E-1' },
    canonicalRef: { kind: 'intervention', id: 'INT-1' }, confidence: 0.9, score: 90,
  }] }
  const ragAdapter = { query: async () => [{
    id: 'r1', hotelId: 'gio', content: 'Procedura sostituzione ventilconvettore', source: { kind: 'chunk', id: 'C-1' },
    canonicalRef: { kind: 'procedure', id: 'PROC-7' }, confidence: 0.88, score: 88,
  }] }
  const gateway = new RandKnowledgeGateway({ mind, graphAdapter, ragAdapter })
  const result = await gateway.query('ventilconvettore 1101', access)
  assert.equal(result.authorization.allowed, true)
  assert.equal(result.hits.length, 3)
  assert.equal(result.backends.randmind.status, 'OK')
  assert.equal(result.backends.graphiti.status, 'OK')
  assert.equal(result.backends.lightrag.status, 'OK')
  assert.equal(result.hits.find((hit) => hit.backend === 'graphiti').rebuildable, true)
  assert.equal(result.hits.find((hit) => hit.backend === 'randmind').rebuildable, false)
})

test('Group 2: malformed or cross-hotel projection rows are rejected, not leaked', async () => {
  const mind = { recall: async () => [memory()] }
  const graphAdapter = { query: async () => [
    { hotelId: 'choco', content: 'dato altro hotel', source: { kind: 'edge', id: 'bad' }, canonicalRef: { kind: 'issue', id: 'x' } },
    { hotelId: 'gio', content: 'senza canonical provenance', source: { kind: 'edge', id: 'bad2' } },
  ] }
  const gateway = new RandKnowledgeGateway({ mind, graphAdapter })
  const result = await gateway.query('motore', access)
  assert.equal(result.hits.length, 1)
  assert.equal(result.backends.graphiti.status, 'DEGRADED')
  assert.equal(result.backends.graphiti.rejected, 2)
})

test('Group 2: unavailable projection backend degrades safely and RandMind remains usable', async () => {
  const mind = { recall: async () => [memory()] }
  const ragAdapter = { query: async () => { throw new Error('offline') } }
  const gateway = new RandKnowledgeGateway({ mind, ragAdapter })
  const result = await gateway.query('motore', access)
  assert.equal(result.hits.length, 1)
  assert.equal(result.hits[0].backend, 'randmind')
  assert.equal(result.backends.lightrag.status, 'UNAVAILABLE')
})
