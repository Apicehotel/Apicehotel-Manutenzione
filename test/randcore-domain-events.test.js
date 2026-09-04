import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(new URL('../supabase/migrations/20260904090000_randcore_domain_events_webhook_foundation.sql', import.meta.url), 'utf8')

test('RandCore point 1 has one append-only event envelope and separate webhook delivery queue', () => {
  assert.match(migration, /create table if not exists public\.rand_domain_events/i)
  assert.match(migration, /idempotency_key text not null unique/i)
  assert.match(migration, /revoke all on public\.rand_domain_events from anon, authenticated/i)
  assert.match(migration, /create table if not exists public\.rand_webhook_deliveries/i)
  assert.match(migration, /unique\(event_id, subscription_id\)/i)
  assert.match(migration, /endpoint_url text not null check \(endpoint_url ~ '\^https:\/\/'\)/i)
})

test('domain event capture is hotel-scoped, sanitized and attached only to existing tables', () => {
  assert.match(migration, /v_hotel_id := nullif\(v_record->>'hotel_id', ''\)/i)
  assert.match(migration, /if v_hotel_id is null then/i)
  assert.match(migration, /jsonb_build_object\('table', tg_table_name, 'operation', tg_op, 'aggregate_id', v_aggregate_id\)/i)
  assert.match(migration, /foreach v_table in array array\[/i)
  assert.match(migration, /'segnalazioni'.*'interventi'.*'richieste_urgenti'/s)
})

test('webhook configuration never stores a raw secret and uses service-only access', () => {
  assert.match(migration, /secret_ref text not null/i)
  assert.doesNotMatch(migration, /secret text not null/i)
  assert.match(migration, /revoke all on public\.rand_webhook_subscriptions from anon, authenticated/i)
  assert.match(migration, /revoke all on public\.rand_webhook_deliveries from anon, authenticated/i)
})
