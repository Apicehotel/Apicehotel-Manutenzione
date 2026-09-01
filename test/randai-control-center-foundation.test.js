import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const controlCenter = await readFile(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')
const config = await readFile(new URL('../src/config.js', import.meta.url), 'utf8')

test('RandAI control center exposes the six operational foundation modules', () => {
  for (const label of ['Overview', 'WhatsApp', 'Segnalazioni', 'Tecnici', 'Worker', 'Log']) {
    assert.match(controlCenter, new RegExp(`['\"]${label}['\"]`))
  }
})

test('RandAI foundation exposes hotel scope, service health and permission state', () => {
  assert.match(controlCenter, /Struttura attiva/)
  assert.match(controlCenter, /Stato sistema/)
  assert.match(controlCenter, /Supabase \/ dati RandApp/)
  assert.match(controlCenter, /Permessi console/)
  assert.match(controlCenter, /can_access_admin/)
})

test('WhatsApp and worker status are fail-closed instead of simulated online', () => {
  assert.match(controlCenter, /Webhook inbound non configurato/)
  assert.match(controlCenter, /Nessun worker è dichiarato online/)
  assert.match(config, /TWILIO = Object\.freeze\(\{ enabled: false, inboundWebhook: null/)
})

test('existing advanced RandAI modules remain reachable', () => {
  for (const label of ['Manutenzioni', 'Conoscenze', 'Impianti', 'Sensori']) {
    assert.match(controlCenter, new RegExp(`['\"]${label}['\"]`))
  }
})
