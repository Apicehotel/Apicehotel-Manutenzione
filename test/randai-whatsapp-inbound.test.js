import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const config = read('src/config.js')
const proxy = read('api/whatsapp/incoming.js')
const edge = read('supabase/functions/randai-whatsapp-inbound/index.ts')
const ui = read('src/randai/control/WhatsAppConsole.jsx')
const control = read('src/randai/control/RandAIControlCenter.jsx')
const migration = read('supabase/migrations/20260901231000_randai_whatsapp_inbound_foundation.sql')
const manual = read('supabase/migrations/20260901234500_randai_whatsapp_manual_actions.sql')

test('Twilio inbound endpoint is configured for Giò and Choco', () => {
  assert.match(config, /\+390759978247/)
  assert.match(config, /\+390759970610/)
  assert.match(config, /inboundWebhook:\s*'\/api\/whatsapp\/incoming'/)
  assert.match(proxy, /x-twilio-signature/)
  assert.match(proxy, /x-randai-webhook-url/)
})

test('inbound pipeline is idempotent and receive-first', () => {
  assert.match(migration, /message_sid text not null unique/i)
  assert.match(edge, /\.eq\("message_sid", messageSid\)/)
  assert.match(edge, /processing_status:\s*initialStatus/)
  assert.match(edge, /if \(!channel\.ingestion_enabled\) return twiml\(""\)/)
})

test('pause never silently creates a RandApp issue', () => {
  const pauseIndex = edge.indexOf('if (!channel.ingestion_enabled) return twiml("")')
  const issueIndex = edge.indexOf('.from("segnalazioni").insert')
  assert.ok(pauseIndex > 0)
  assert.ok(issueIndex > pauseIndex)
  assert.match(migration, /ingestion_enabled boolean not null default false/i)
})

test('media is preserved before paused processing exits', () => {
  const preserveIndex = edge.indexOf('preserveImage(')
  const pauseIndex = edge.lastIndexOf('if (!channel.ingestion_enabled) return twiml("")')
  assert.ok(preserveIndex > 0)
  assert.ok(pauseIndex > preserveIndex)
  assert.match(edge, /maintenance-photos/)
})

test('RandAI console exposes live inbox and protected ingestion toggle', () => {
  assert.match(control, /WhatsAppConsole/)
  assert.match(ui, /whatsapp_inbound_messages/)
  assert.match(ui, /whatsapp_channel_settings/)
  assert.match(ui, /whatsapp_set_ingestion/)
  assert.match(ui, /RandApp IN PAUSA/)
  assert.match(ui, /Non inviato a RandApp/)
  assert.match(migration, /can_access_admin = true/)
})

test('paused messages require an explicit safe decision', () => {
  assert.match(ui, /Crea segnalazione/)
  assert.match(ui, /Collega a segnalazione esistente/)
  assert.match(ui, />Ignora</)
  assert.match(ui, /whatsapp_create_issue_from_inbound/)
  assert.match(ui, /whatsapp_link_inbound/)
  assert.match(ui, /whatsapp_ignore_inbound/)
  assert.match(manual, /cross-hotel link denied/)
  assert.match(manual, /location and problem are required/)
  assert.match(manual, /processing_status='ignored'/)
  assert.match(manual, /processing_status='linked'/)
  assert.match(manual, /processing_status='created'/)
})
