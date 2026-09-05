import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260905100200_randchat_anon_acl_hardening.sql', import.meta.url), 'utf8')

test('RandChat revokes PUBLIC and anon execution from every chat function', () => {
  assert.match(migration, /p\.proname like 'chat_%'/i)
  assert.match(migration, /revoke all on function %s from public, anon/i)
})

test('only intended roles are re-granted RandChat RPC execution', () => {
  assert.match(migration, /chat_create_group\(text, text, smallint, text\) to authenticated/i)
  assert.match(migration, /chat_dm_send_message\(uuid, uuid, uuid, text, text, jsonb, text, jsonb\) to authenticated/i)
  assert.match(migration, /chat_write_audit\(text, text, text, text, jsonb, uuid\) to service_role/i)
  assert.match(migration, /cleanup_expired_dm_messages\(\) to service_role/i)
  assert.doesNotMatch(migration, /to anon/i)
})
