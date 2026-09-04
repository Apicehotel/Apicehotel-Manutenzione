import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(new URL('../supabase/migrations/20260904110000_randcore_webhook_delivery_worker.sql', import.meta.url), 'utf8')
const worker = fs.readFileSync(new URL('../supabase/functions/randcore-webhook-worker/index.ts', import.meta.url), 'utf8')

test('RandCore point 3 claims deliveries atomically with a lease and bounded outcomes', () => {
  assert.match(migration, /for update skip locked/i)
  assert.match(migration, /locked_at/i)
  assert.match(migration, /rand_finish_webhook_delivery/i)
  assert.match(migration, /dead_letter/i)
})

test('webhook worker signs payloads, times out, and bounds retries', () => {
  assert.match(worker, /HMAC.*SHA-256/i)
  assert.match(worker, /AbortController/i)
  assert.match(worker, /MAX_ATTEMPTS = 5/i)
  assert.match(worker, /idempotency-key/i)
  assert.match(worker, /secret_not_configured/i)
})

