import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { HOTELS, WHATSAPP } from '../src/config.js'
import { HOTEL_LOCATIONS } from '../src/locations.js'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const HOTEL_IDS = ['hotelgio', 'chocohotel', 'brigantino']

test('all production hotels have the shared shell inputs', () => {
  assert.deepEqual(HOTELS.map((hotel) => hotel.id), HOTEL_IDS)
  for (const hotelId of HOTEL_IDS) {
    assert.ok(HOTEL_LOCATIONS[hotelId]?.roomGroups?.length)
    assert.ok(HOTEL_LOCATIONS[hotelId]?.zones?.length)
  }
})

test('Planning Sale availability is role driven for every hotel', async () => {
  const nav = await source('src/randapp/nav.js')
  assert.match(nav, /'planning-sale': view\('planning_sale'\)/)
  assert.doesNotMatch(nav, /hotel\?\.id\s*===\s*['"]hotelgio['"]/)
})

test('hotel-specific integrations cannot silently omit a structure', () => {
  assert.deepEqual(Object.keys(WHATSAPP.destinations), HOTEL_IDS)
})

test('multi-hotel isolation gates remain part of the suite', async () => {
  const relational = await source('test/point11-multihotel.test.js')
  const randai = await source('test/randai-query-scope.test.js')
  const offline = await source('src/offline-store.js')
  assert.match(relational, /cross hotel boundaries/i)
  assert.match(randai, /hotel_id/)
  assert.match(offline, /cacheKey = \(entity, hotelId\)/)
})
