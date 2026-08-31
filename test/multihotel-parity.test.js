import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const HOTELS = ['hotelgio', 'chocohotel', 'brigantino']

test('core hotel catalogue contains all three independent structures', async () => {
  const config = await source('src/config.js')
  for (const hotelId of HOTELS) assert.match(config, new RegExp(`id: '${hotelId}'`))
})

test('shared navigation does not hide Planning Sale by hotel id', async () => {
  const nav = await source('src/randapp/nav.js')
  assert.match(nav, /'planning-sale': view\('planning_sale'\)/)
  assert.doesNotMatch(nav, /planning-sale[^\n]*hotelgio/)
})

test('Planning Sale is fully hotel-scoped instead of Giò-scoped', async () => {
  const sale = await source('src/randapp/PlanningSaleSimple.jsx')
  for (const call of ['fetchBookings', 'fetchSaleRooms', 'fetchSaleClients', 'fetchSaleLayouts']) {
    assert.match(sale, new RegExp(`${call}\\(hotel\\.id`))
  }
  assert.match(sale, /subscribeBookings\(hotel\.id/)
  assert.match(sale, /subscribeSaleRooms\(hotel\.id/)
  assert.doesNotMatch(sale, /hotelgio/)
})

test('Housekeeping has room groups for every hotel and server reads remain hotel scoped', async () => {
  const [locations, housekeeping] = await Promise.all([
    source('src/locations.js'),
    source('src/housekeeping-v2.jsx'),
  ])
  for (const hotelId of HOTELS) {
    assert.match(locations, new RegExp(`${hotelId}: \\{[\\s\\S]*?roomGroups:`))
  }
  assert.match(housekeeping, /\.eq\('hotel_id',hotel\.id\)/)
  assert.match(housekeeping, /cacheForHotel\(hotel\.id\)/)
})

test('shared core feature gates are permission-based, not hotel-name based', async () => {
  const nav = await source('src/randapp/nav.js')
  for (const module of ['issues', 'interventions', 'urgent', 'reminders', 'housekeeping', 'temperature', 'technicians']) {
    assert.match(nav, new RegExp(`view\\('${module}'\\)`))
  }
  assert.doesNotMatch(nav, /hotel\?\.id\s*===\s*'hotelgio'/)
  assert.doesNotMatch(nav, /hotel\?\.id\s*===\s*'chocohotel'/)
  assert.doesNotMatch(nav, /hotel\?\.id\s*===\s*'brigantino'/)
})

test('external integration configuration keeps explicit slots for every hotel', async () => {
  const config = await source('src/config.js')
  const destinationsBlock = config.match(/destinations:\s*Object\.freeze\(\{([\s\S]*?)\}\),\n\s*\}\)/)?.[1] || config
  for (const hotelId of HOTELS) assert.match(destinationsBlock, new RegExp(`${hotelId}:`))
})
