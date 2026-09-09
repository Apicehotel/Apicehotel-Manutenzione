import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('Sensors v2 exposes summary, severity ordering and semantic states', () => {
  const source = read('../src/temperature.jsx')
  assert.match(source, /temperature-summary/)
  assert.match(source, /severity\(b\) - severity\(a\)/)
  assert.match(source, /temperature-status--offline/)
  assert.match(source, /temperature-status--alert/)
  assert.match(source, /temperature-status--online/)
  assert.match(source, /summary\.offline/)
  assert.match(source, /summary\.alerts/)
})

test('Sensors v2 keeps Plants workflow unchanged and shares responsive card language', () => {
  const source = read('../src/temperature.jsx')
  const css = read('../src/sensor-switches.css')
  assert.match(source, /export function PlantStatus/)
  assert.match(source, /groupSwitches\(sensors\)/)
  assert.match(css, /temperature-list--v2/)
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 520px\)/)
})
