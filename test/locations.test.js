import test from 'node:test'
import assert from 'node:assert/strict'
import { getHotelRooms, getHotelZones, HOTEL_LOCATIONS } from '../src/locations.js'

test('catalogo camere e zone importato per tutte le strutture', () => {
  assert.equal(getHotelRooms('hotelgio').length, 202)
  assert.equal(getHotelRooms('chocohotel').length, 94)
  assert.equal(getHotelRooms('brigantino').length, 54)
  assert.equal(getHotelZones('hotelgio').length, 78)
  assert.equal(getHotelZones('chocohotel').length, 26)
  assert.equal(getHotelZones('brigantino').length, 14)
  assert.equal(new Set(getHotelZones('brigantino').map((zone) => zone.name)).size, 14)
  assert(HOTEL_LOCATIONS.hotelgio.zones.some((zone) => zone.name === 'Sala Cravatte'))
})
