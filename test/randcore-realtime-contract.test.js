import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(new URL('../supabase/migrations/20260904100000_randcore_realtime_publication_contract.sql', import.meta.url), 'utf8')

test('RandCore point 2 publishes the complete client realtime contract idempotently', () => {
  assert.match(migration, /pg_publication_tables/i)
  assert.match(migration, /not exists/i)
  for (const table of [
    'planning_lavori', 'planning_lavori_giorni', 'promemoria', 'promemoria_invio',
    'notification_reads', 'inventory_items', 'inventory_movements', 'inventory_categories',
    'inventory_locations', 'whatsapp_inbound_messages', 'technician_dispatch_requests'
  ]) assert.match(migration, new RegExp(`'${table}'`, 'i'))
})

test('service-only event and webhook tables are excluded from client realtime', () => {
  assert.doesNotMatch(migration, /'rand_domain_events'/i)
  assert.doesNotMatch(migration, /'rand_webhook_deliveries'/i)
  assert.match(migration, /service-only event and webhook tables are intentionally excluded/i)
})
