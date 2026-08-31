import test from 'node:test'
import assert from 'node:assert/strict'
import { LearningEngine } from '../src/randai/learning/engine.js'
import { LearningStore } from '../src/randai/learning/store.js'

const experience = (hotelId, sourceId) => ({
  hotelId,
  problemClass: 'climatizzazione',
  strategy: 'Verifica valvola e conferma ripristino',
  tools: ['human.checkpoint'],
  successCriteria: ['raffreddamento ripristinato'],
  verified: true,
  source: { kind: 'issue', id: sourceId },
  metadata: { hotelId, taskId: `task-${sourceId}` },
})

test('block 31 keeps identical verified patterns isolated by hotel', async () => {
  const store = new LearningStore()
  const engine = new LearningEngine({ store, minEvidence: 2 })
  const gio1 = await engine.observe(experience('hotelgio', 'g1'))
  const choco1 = await engine.observe(experience('chocohotel', 'c1'))
  const gio2 = await engine.observe(experience('hotelgio', 'g2'))

  assert.notEqual(gio1.fingerprint, choco1.fingerprint)
  assert.equal(gio2.hotelId, 'hotelgio')
  assert.equal(gio2.evidence.length, 2)
  assert.equal(gio2.status, 'CANDIDATE')
  assert.equal((await store.list({ hotelId: 'chocohotel' })).length, 1)
  assert.equal((await store.list({ hotelId: 'hotelgio' })).length, 1)
})

test('block 31 refuses unverified experiences', async () => {
  const engine = new LearningEngine()
  await assert.rejects(
    () => engine.observe({ ...experience('hotelgio', 'g3'), verified: false }),
    /Only verified experiences can be learned/,
  )
})
