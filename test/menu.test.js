import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('menu operativo include azioni reali e permessi Planning Sale HotelGio', async () => {
  const [app, config] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/config.js', import.meta.url), 'utf8'),
  ])

  for (const label of ['Pulisci cache', 'Cambia struttura', 'Il mio profilo', 'Cambia PIN', 'Manuale', 'Feedback', 'Esporta CSV', 'Logout']) {
    assert.match(app, new RegExp(`>${label}<`))
  }
  assert.match(app, /exportIssuesCsv/)
  assert.match(app, /subscribeToPush\(hotel\.id\)/)
  assert.match(config, /admin: \[[^\]]*'planning_sale'/)
  assert.match(config, /'Direttore Centro Congressi': \[[^\]]*'planning_sale'/)
  assert.doesNotMatch(config, /manutentore: \[[^\]]*'planning_sale'/)
})
