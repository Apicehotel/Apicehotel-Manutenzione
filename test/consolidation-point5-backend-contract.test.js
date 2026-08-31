import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('sale configuration and bookings carry hotel context', async () => {
  const [bookings, rooms, directory] = await Promise.all([
    source('src/sale-data.js'),
    source('src/sale-config-data.js'),
    source('src/sale-directory-data.js'),
  ])
  assert.match(bookings, /hotel_id/)
  assert.match(bookings, /eq\('hotel_id',hotelId\)/)
  assert.match(bookings, /filter:`hotel_id=eq\.\$\{hotelId\}`/)
  assert.match(rooms, /hotel_id/)
  assert.match(directory, /hotel_id/)
})

test('housekeeping queries and realtime remain hotel scoped', async () => {
  const housekeeping = await source('src/housekeeping-v2.jsx')
  assert.match(housekeeping, /eq\('hotel_id',hotel\.id\)/)
  assert.match(housekeeping, /filter:`hotel_id=eq\.\$\{hotel\.id\}`/)
  assert.match(housekeeping, /randappHousekeepingV2-\$\{hotelId\}/)
})
