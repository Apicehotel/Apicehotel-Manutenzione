import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OperationalSourceDisposition,
  RAND_OPERATIONAL_GROUP2_SOURCES,
  assertOperationalGroup2Sources,
  getOperationalGroup2Source,
} from '../src/randai/core/operational-source-governance.js'
import {
  createHousekeepingFloorContext,
  changeHousekeepingFloor,
  buildHousekeepingIssueDraft,
} from '../src/randapp/operations/housekeeping-floor-context.js'

test('group2 source registry rejects runtime duplication', () => {
  assert.equal(assertOperationalGroup2Sources(), true)
  assert.equal(RAND_OPERATIONAL_GROUP2_SOURCES.length, 6)
  for (const source of RAND_OPERATIONAL_GROUP2_SOURCES) {
    assert.equal(source.runtimeDependency, false)
    assert.equal(source.replacesCanonicalOwner, false)
  }
  assert.equal(getOperationalGroup2Source('housekeeping-hotel').disposition, OperationalSourceDisposition.ADAPT)
  assert.equal(getOperationalGroup2Source('cryptboard').disposition, OperationalSourceDisposition.IGNORE_RUNTIME)
})

test('housekeeping defaults to assigned floor and locks hotel scope', () => {
  const context = createHousekeepingFloorContext({
    hotelId: 'gio',
    assignedFloors: ['1-jazz', '2-jazz'],
    canChangeFloor: true,
  })
  assert.equal(context.hotelId, 'gio')
  assert.equal(context.selectedFloor, '1-jazz')
  assert.equal(context.hotelLocked, true)
  assert.deepEqual(context.assignedFloors, ['1-jazz', '2-jazz'])
  assert.throws(() => changeHousekeepingFloor(context, '2-jazz', { hotelId: 'choco' }), /cannot switch hotel/)
})

test('housekeeping floor change stays inside assignment', () => {
  const context = createHousekeepingFloorContext({ hotelId: 'gio', assignedFloors: ['1', '2'], canChangeFloor: true })
  assert.equal(changeHousekeepingFloor(context, '2').selectedFloor, '2')
  assert.throws(() => changeHousekeepingFloor(context, '3'), /outside the assigned floor set/)
  const locked = createHousekeepingFloorContext({ hotelId: 'gio', assignedFloors: ['1'], canChangeFloor: false })
  assert.throws(() => changeHousekeepingFloor(locked, '1'), /not allowed/)
})

test('housekeeping issue draft preserves hotel and delegates persistence to Issues', () => {
  const context = createHousekeepingFloorContext({ hotelId: 'brigantino', assignedFloors: ['2'], selectedFloor: '2' })
  const draft = buildHousekeepingIssueDraft(context, { locationId: 'camera-204', description: 'Lampadina guasta' })
  assert.equal(draft.hotelId, 'brigantino')
  assert.equal(draft.floor, '2')
  assert.equal(draft.locationId, 'camera-204')
  assert.equal(draft.persistenceOwner, 'ISSUES')
  assert.equal(draft.requiresExistingIssueAuthorization, true)
})
