import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const controlCenter = await readFile(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')
const systemConsole = await readFile(new URL('../src/randai/control/SystemControlConsole.jsx', import.meta.url), 'utf8')
const config = await readFile(new URL('../src/config.js', import.meta.url), 'utf8')

test('RandAI control center exposes the six operational foundation modules', () => {
  for (const label of ['Overview', 'WhatsApp', 'Segnalazioni', 'Tecnici', 'Worker', 'Log']) assert.match(controlCenter, new RegExp(`['\\"]${label}['\\"]`))
})

test('RandAI foundation exposes hotel scope, service health and permission state', () => {
  assert.match(controlCenter, /Struttura attiva/)
  assert.match(controlCenter, /Stato sistema/)
  assert.match(controlCenter, /Supabase \/ dati RandApp/)
  assert.match(controlCenter, /Permessi console/)
  assert.match(controlCenter, /can_access_admin/)
})

test('WhatsApp follows configured ingress and Worker uses backend verified state', () => {
  assert.match(controlCenter, /Boolean\(TWILIO\?\.enabled && TWILIO\?\.inboundWebhook\)/)
  assert.match(controlCenter, /Worker stato da pg_cron/)
  assert.match(systemConsole, /randai_control_snapshot/)
  assert.match(systemConsole, /Dati verificati dal backend/)
  assert.match(config, /TWILIO = Object\.freeze\(\{[\s\S]*enabled: true,[\s\S]*inboundWebhook: ['"]\/api\/whatsapp\/incoming['"]/)
  assert.match(config, /automaticMessages: false/)
})

test('existing advanced RandAI modules remain reachable', () => {
  for (const label of ['Manutenzioni', 'Conoscenze', 'Impianti', 'Sensori']) assert.match(controlCenter, new RegExp(`['\\"]${label}['\\"]`))
})
