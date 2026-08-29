import test from 'node:test'
import assert from 'node:assert/strict'
import { displaySensorName, groupSwitches, parseWineCircuit, switchStatus, temperatureSensors } from '../src/sensor-display.js'

test('parses Wine room circuits and formats room labels', () => {
  assert.deepEqual(parseWineCircuit('A1 da 201 a 204+225+226+227'), {
    circuit: 1,
    floor: 2,
    firstRoom: 201,
    lastRoom: 204,
    extraRooms: [225, 226, 227],
  })
  assert.equal(displaySensorName({ nome: 'A1 da 201 a 204+225+226+227' }), 'A1 · Camere 201–204, 225, 226, 227')
})

test('orders Wine circuits by floor and A1 A2 A3 regardless of input order', () => {
  const input = [
    { device_id: 'p2-a3', nome: 'A3 da 228 a 233', temperatura: null },
    { device_id: 'p1-a2', nome: 'A2 da 109 a 125', temperatura: null },
    { device_id: 'p2-a1', nome: 'A1 da 201 a 204+225+226+227', temperatura: null },
    { device_id: 'p1-a3', nome: 'A3 da 126 a 131', temperatura: null },
    { device_id: 'p1-a1', nome: 'A1 da 101 a 108', temperatura: null },
    { device_id: 'p2-a2', nome: 'A2 da 205 a 224', temperatura: null },
  ]
  const wine = groupSwitches(input)[0]
  assert.equal(wine.id, 'wine')
  assert.deepEqual(wine.groups.map((g) => g.label), ['Piano 1', 'Piano 2'])
  assert.deepEqual(wine.groups[0].sensors.map((s) => s.device_id), ['p1-a1', 'p1-a2', 'p1-a3'])
  assert.deepEqual(wine.groups[1].sensors.map((s) => s.device_id), ['p2-a1', 'p2-a2', 'p2-a3'])
})

test('orders plant sections logically', () => {
  const rows = [
    { device_id: 'tech', nome: 'Allarme acqua calda sanitaria', temperatura: null },
    { device_id: 'sale', nome: 'SALA GUSTO', temperatura: null },
    { device_id: 'rest', nome: 'RISTORANTE 2 Fontivegge Vinarelli', temperatura: null },
    { device_id: 'hall', nome: 'HALL Wine', temperatura: null },
    { device_id: 'bath', nome: 'A2 Termobagno lato Gaggi', temperatura: null },
    { device_id: 'wine', nome: 'A1 da 101 a 108', temperatura: null },
  ]
  assert.deepEqual(groupSwitches(rows).map((s) => s.id), ['wine', 'termobagni', 'hall', 'ristorante', 'sale', 'tecnici'])
})

test('offline always wins over stale relay state', () => {
  assert.deepEqual(switchStatus({ online: false, switch_state: 'off' }), { key: 'unavailable', label: 'NON DISPONIBILE' })
  assert.deepEqual(switchStatus({ online: true, switch_state: 'on' }), { key: 'on', label: 'ATTIVO' })
  assert.deepEqual(switchStatus({ online: true, switch_state: 'off' }), { key: 'off', label: 'SPENTO' })
})

test('keeps temperature devices out of switch groups', () => {
  const temp = { device_id: 'temp', nome: 'Temp tetto', temperatura: '17', ordine: 1 }
  const relay = { device_id: 'relay', nome: 'HALL Wine', temperatura: null }
  assert.equal(groupSwitches([temp, relay])[0].groups[0].sensors.length, 1)
  assert.deepEqual(temperatureSensors([relay, temp]).map((s) => s.device_id), ['temp'])
})
