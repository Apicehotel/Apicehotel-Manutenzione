import test from 'node:test'
import assert from 'node:assert/strict'
import { GuidanceStore, GuidedProcedureEngine, validateGuidedProcedure } from '../src/randai/guidance/index.js'

test('guided procedure rejects dangling branch targets before execution', () => {
  assert.throws(() => validateGuidedProcedure({
    id: 'broken', hotelId: 'hotelgio', title: 'Broken',
    steps: [{ id: 'start', title: 'Start', next: { DONE: 'missing-step' } }],
  }), /Unknown guided next step/)
})

test('guidance store keeps hotel sessions isolated', async () => {
  const store = new GuidanceStore()
  const engine = new GuidedProcedureEngine({ store })
  const procedure = (hotelId) => ({ id: `p-${hotelId}`, hotelId, title: 'Check', steps: [{ id: 'start', title: 'Start', next: { DONE: null } }] })
  await engine.start({ procedure: procedure('hotelgio'), actorRole: 'staff' })
  await engine.start({ procedure: procedure('chocohotel'), actorRole: 'staff' })
  const gio = await store.list({ hotelId: 'hotelgio' })
  assert.equal(gio.length, 1)
  assert.equal(gio[0].hotelId, 'hotelgio')
})
