import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHvacDiagnostic, extractJazzFloor, extractRoomNumber, inferHvacMode, selectHvacZone } from '../supabase/functions/_shared/hvac-routing.js'

const zones = [
  { zone_id: 'wine-p1-a2', hotel_id: 'hotelgio', section: 'wine', floor: 1, circuit: 'A2', label: 'Wine P1 A2', room_numbers: [109, 125], switch_device_id: 'switch-a2', temperature_device_ids: ['roof-1', 'roof-2', 'roof-3'] },
  { zone_id: 'wine-p2-a1', hotel_id: 'hotelgio', section: 'wine', floor: 2, circuit: 'A1', label: 'Wine P2 A1', room_numbers: [201, 202, 203, 204, 225, 226, 227], switch_device_id: 'switch-a1-p2', temperature_device_ids: ['roof-1', 'roof-2', 'roof-3'] },
  { zone_id: 'jazz-p3', hotel_id: 'hotelgio', section: 'jazz', floor: 3, circuit: null, label: 'Jazz P3', room_numbers: [3301, 3302, 3303, 3304, 3305], switch_device_id: null, temperature_device_ids: ['jazz-p3-temp'] },
]

test('extracts 3 and 4 digit rooms and cooling intent', () => {
  assert.equal(extractRoomNumber('Camera 125 non fredda'), 125)
  assert.equal(extractRoomNumber('Camera · 3305 non fredda'), 3305)
  assert.equal(inferHvacMode('Camera 125 non fredda'), 'cooling')
})

test('routes Wine room 125 to A2', () => {
  const resolved = selectHvacZone(zones, 'Camera 125 non fredda')
  assert.equal(resolved.zone.zone_id, 'wine-p1-a2')
  assert.equal(resolved.zone.circuit, 'A2')
  assert.equal(resolved.room, 125)
})

test('routes Wine room 204 to second-floor A1', () => {
  const resolved = selectHvacZone(zones, 'La camera 204 non raffresca')
  assert.equal(resolved.zone.zone_id, 'wine-p2-a1')
  assert.equal(resolved.zone.floor, 2)
})

test('routes Jazz by explicit floor and by real four-digit room', () => {
  assert.equal(extractJazzFloor('Jazz terzo piano non fredda'), 3)
  assert.equal(extractJazzFloor('Camera 3305 non fredda'), 3)
  assert.equal(selectHvacZone(zones, 'Jazz piano 3 non fredda').zone.zone_id, 'jazz-p3')
  assert.equal(selectHvacZone(zones, 'Camera · 3305 non fredda').zone.zone_id, 'jazz-p3')
})

test('builds Wine diagnostic from three roof temperatures and real relay state', () => {
  const zone = zones[0]
  const now = Date.parse('2026-08-29T18:40:00Z')
  const sensors = [
    { device_id: 'roof-1', nome: 'Tetto 1', temperatura: 17, online: true, in_allerta: false, aggiornato_il: '2026-08-29T18:30:00Z' },
    { device_id: 'roof-2', nome: 'Tetto 2', temperatura: 16.5, online: true, in_allerta: false, aggiornato_il: '2026-08-29T18:30:00Z' },
    { device_id: 'roof-3', nome: 'Tetto 3', temperatura: 18.4, online: true, in_allerta: false, aggiornato_il: '2026-08-29T18:30:00Z' },
    { device_id: 'switch-a2', nome: 'A2 da 109 a 125', temperatura: null, online: true, switch_state: 'on', in_allerta: false, aggiornato_il: '2026-08-29T18:30:00Z' },
  ]
  const diagnostic = buildHvacDiagnostic({ zone, room: 125, mode: 'cooling', sensors, now })
  assert.equal(diagnostic.switch.status_label, 'ATTIVO')
  assert.equal(diagnostic.temperatures.length, 3)
  assert.equal(diagnostic.conclusion, 'circuit-on-check-downstream')
  assert.equal(diagnostic.thresholds_defined, false)
})

test('Jazz includes the floor temperature for a real room', () => {
  const zone = zones[2]
  const now = Date.parse('2026-08-29T18:40:00Z')
  const sensors = [{ device_id: 'jazz-p3-temp', nome: 'Temp. C/F Jazz P3', temperatura: 13.7, online: true, in_allerta: false, aggiornato_il: '2026-08-29T18:30:00Z' }]
  const diagnostic = buildHvacDiagnostic({ zone, room: 3305, mode: 'cooling', sensors, now })
  assert.equal(diagnostic.room, 3305)
  assert.equal(diagnostic.temperatures[0].temperature, 13.7)
  assert.equal(diagnostic.switch, null)
  assert.equal(diagnostic.conclusion, 'floor-temperature-available-switch-unmapped')
})
