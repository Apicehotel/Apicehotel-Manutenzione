import test from 'node:test'
import assert from 'node:assert/strict'
import { partitionTemperatureSensors, readSensorCache, writeSensorCache } from '../src/sensor-cache.js'

test('partitionTemperatureSensors surfaces alert and offline before ok', () => {
  const partitioned = partitionTemperatureSensors([
    { device_id: 'ok', nome: 'Zebra', online: true, in_allerta: false, ordine: 2 },
    { device_id: 'alert', nome: 'Alert', online: true, in_allerta: true },
    { device_id: 'off', nome: 'Offline', online: false, in_allerta: false },
    { device_id: 'ok2', nome: 'Alpha', online: true, in_allerta: false, ordine: 1 },
  ])
  assert.deepEqual(partitioned.alerts.map((s) => s.device_id), ['alert'])
  assert.deepEqual(partitioned.offline.map((s) => s.device_id), ['off'])
  assert.deepEqual(partitioned.ok.map((s) => s.device_id), ['ok2', 'ok'])
})

test('sensor cache round-trips hotel-scoped rows and fails soft', () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
  }
  assert.deepEqual(readSensorCache('hotelgio'), [])
  writeSensorCache('hotelgio', [{ device_id: 'a', temperatura: 4 }])
  assert.equal(readSensorCache('hotelgio')[0].device_id, 'a')
  assert.deepEqual(readSensorCache('chocohotel'), [])
  store.set('randapp.sensors.v1.hotelgio', '{not-json')
  assert.deepEqual(readSensorCache('hotelgio'), [])
})
