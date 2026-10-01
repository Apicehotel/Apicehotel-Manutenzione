import test from 'node:test'
import assert from 'node:assert/strict'
import { getHotelRooms, getHotelZones, HOTEL_LOCATIONS } from '../src/locations.js'

test('catalogo camere e zone importato per tutte le strutture', () => {
  assert.equal(getHotelRooms('hotelgio').length, 202)
  assert.equal(getHotelRooms('chocohotel').length, 94)
  assert.equal(getHotelRooms('brigantino').length, 54)
  const hotelGioZones = getHotelZones('hotelgio')
  assert(hotelGioZones.length >= 78)
  assert.equal(new Set(hotelGioZones.map((zone) => zone.name.toLowerCase())).size, hotelGioZones.length)
  for (const required of ['Sala Cravatte', 'Cantina', 'Gusto', '1 jazz', '2 jazz', '3 jazz', '4 jazz', '1 wine', '2 wine', '3 wine', '4 wine']) {
    assert(hotelGioZones.some((zone) => zone.name === required), `Zona Hotel Giò mancante: ${required}`)
  }
  assert.equal(getHotelZones('chocohotel').length, 26)
  assert.equal(getHotelZones('brigantino').length, 14)
  assert.equal(new Set(getHotelZones('brigantino').map((zone) => zone.name)).size, 14)
  assert(HOTEL_LOCATIONS.hotelgio.zones.length === hotelGioZones.length)
})
