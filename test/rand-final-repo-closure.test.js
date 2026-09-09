import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { RAND_OPERATIONAL_GROUP2_SOURCES, assertOperationalGroup2Sources } from '../src/randai/core/operational-source-governance.js'
import { createHousekeepingFloorContext, changeHousekeepingFloor } from '../src/randapp/operations/housekeeping-floor-context.js'

test('evaluated operational repositories have a terminal governed disposition', () => {
  assert.equal(assertOperationalGroup2Sources(), true)
  assert.equal(RAND_OPERATIONAL_GROUP2_SOURCES.length, 6)
  assert.equal(RAND_OPERATIONAL_GROUP2_SOURCES.every((source) => ['ADAPT','SOURCE_ONLY','IGNORE_RUNTIME'].includes(source.disposition)), true)
  assert.equal(RAND_OPERATIONAL_GROUP2_SOURCES.every((source) => source.runtimeDependency === false && source.replacesCanonicalOwner === false), true)
})

test('housekeeping floor change remains inside assigned floors and locked hotel', () => {
  const context = createHousekeepingFloorContext({ hotelId:'hotelgio', assignedFloors:['Jazz P1','Jazz P2'], selectedFloor:'Jazz P1', canChangeFloor:true })
  assert.equal(changeHousekeepingFloor(context, 'Jazz P2').selectedFloor, 'Jazz P2')
  assert.throws(() => changeHousekeepingFloor(context, 'Wine P4'), /assigned floor set/)
  assert.throws(() => changeHousekeepingFloor(context, 'Jazz P2', { hotelId:'chocohotel' }), /cannot switch hotel/)
})

test('current Housekeeping UI persists and restores operational floor context', async () => {
  const source = await fs.readFile(new URL('../src/housekeeping-v2.jsx', import.meta.url), 'utf8')
  assert.match(source, /fetchOperationalFloorContexts/)
  assert.match(source, /loadOperationalFloorContext/)
  assert.match(source, /saveOperationalFloorContext/)
  assert.match(source, /selectGroup/)
})
