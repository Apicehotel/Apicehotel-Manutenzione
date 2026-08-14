import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('i sensori temperatura replicano dati live e permessi Hotel Gio', async () => {
  const [app, temperature] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/temperature.jsx', import.meta.url), 'utf8'),
  ])

  assert.match(app, /const canViewTemperature = \(user\) => \['Direzione','Direttore Centro Congressi','manutentore'\]\.includes\(user\.role\) \|\| user\.department === 'Reception'/)
  assert.match(app, /hotel\.id === 'hotelgio' && canViewTemperature\(user\)/)
  assert.match(app, /<span>Temperature<\/span>/)
  assert.match(temperature, /from\('sensori_temperatura'\)/)
  assert.match(temperature, /postgres_changes/)
  assert.match(temperature, /sync-sensori-temperatura/)
  assert.match(temperature, /sopra i 20 °C/)
  assert.match(temperature, /sensor\.online \? 'Online' : '⚠️ Offline'/)
})
