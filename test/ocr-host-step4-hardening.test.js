import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandCore webhook worker uses a dedicated cron secret', () => {
  const worker = read('supabase/functions/randcore-webhook-worker/index.ts')
  const migration = read('supabase/migrations/20261010085400_randcore_webhook_dedicated_cron_secret.sql')
  assert.match(worker, /randcore_webhook_cron_secret/)
  assert.doesNotMatch(worker, /reminder_cron_secret/)
  assert.match(migration, /randcore_webhook_cron_secret/)
})

test('WhatsApp ingress prefers env overrides for upstream and public webhook URL', () => {
  const proxy = read('api/whatsapp/incoming.js')
  assert.match(proxy, /RANDAI_WHATSAPP_INBOUND_URL/)
  assert.match(proxy, /WHATSAPP_PUBLIC_WEBHOOK_URL/)
  assert.match(proxy, /SUPABASE_URL/)
})

test('hotel WhatsApp test requires an explicit recipient', () => {
  const flow = read('supabase/functions/create-and-send-hotel-test-whatsapp/index.ts')
  assert.match(flow, /recipient_required/)
  assert.doesNotMatch(flow, /\+393341196935/)
})

test('MCP ingress shape-checks JWT bearer tokens before handing off to RandGateway', () => {
  const mcp = read('api/mcp.js')
  assert.match(mcp, /jwtShape/)
  assert.match(mcp, /bearer\.length < 40/)
  assert.doesNotMatch(mcp, /authorization\.length < 32/)
})

test('offline drain validates hotel-scoped outbox envelopes', () => {
  const store = read('src/offline-store.js')
  assert.match(store, /validateOutboxOperation/)
  assert.match(store, /idempotencyKey:stableOperationId/)
  assert.match(store, /idempotencyKey: op\.idempotencyKey \|\| op\.operationId/)
})
