import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('Sensors v2 exposes summary, partitioned severity sections and semantic states', () => {
  const source = read('../src/temperature.jsx')
  assert.match(source, /temperature-summary/)
  assert.match(source, /partitionTemperatureSensors/)
  assert.match(source, /SensorSection title="In allerta"/)
  assert.match(source, /SensorSection title="Offline"/)
  assert.match(source, /SensorSection title="Operativi"/)
  assert.match(source, /temperature-status--\$\{statusKey\}/)
  assert.match(source, /statusKey = isOffline \? 'offline' : alert \? 'alert' : 'online'/)
  assert.match(source, /summary\.offline/)
  assert.match(source, /summary\.alerts/)
  assert.match(source, /ListFetchNotice/)
  assert.match(source, /readSensorCache/)
  assert.match(source, /writeSensorCache/)
  assert.match(source, /data-sensor-state/)
})

test('Sensors v2 keeps Plants workflow unchanged and shares responsive card language', () => {
  const source = read('../src/temperature.jsx')
  const css = read('../src/sensor-switches.css')
  assert.match(source, /export function PlantStatus/)
  assert.match(source, /groupSwitches\(sensors\)/)
  assert.match(css, /temperature-list--v2/)
  assert.match(css, /temperature-section/)
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 520px\)/)
})

test('Sensors status label appears before the sensor name', () => {
  const source = read('../src/temperature.jsx')
  const copyStart = source.indexOf('temperature-card__copy')
  const statusAt = source.indexOf('temperature-status', copyStart)
  const nameAt = source.indexOf('<strong>', copyStart)
  assert.ok(copyStart > 0 && statusAt > copyStart && nameAt > statusAt)
})
