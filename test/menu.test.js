import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('menu operativo include azioni reali e permessi Planning Sale HotelGio', async () => {
  const [app, config] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/config.js', import.meta.url), 'utf8'),
  ])

  for (const label of ['Aggiorna', 'Cambia struttura', 'Cambia PIN', 'Notifiche', 'Manuale', 'Feedback', 'Esporta CSV', 'Logout']) {
    assert.match(app, new RegExp(`>${label}<`))
  }
  assert.match(app, /exportIssuesCsv/)
  assert.match(app, /Notification\.requestPermission/)
  assert.match(config, /manutentore: \[[^\]]*'planning_sale'/)
  assert.match(config, /Direzione: \[[^\]]*'planning_sale'/)
})
