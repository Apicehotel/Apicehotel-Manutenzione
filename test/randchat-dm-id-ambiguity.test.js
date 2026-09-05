import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260905110900_randchat_dm_list_messages_id_ambiguity.sql', import.meta.url), 'utf8')

test('chat_dm_list_messages qualifies the device table id in UPDATE', () => {
  assert.match(migration, /update public\.chat_dm_devices d\s+set last_seen_at\s*=\s*now\(\)\s+where d\.id\s*=\s*v_device_row/is)
  assert.doesNotMatch(migration, /where\s+id\s*=\s*v_device_row/i)
})

test('chat_dm_list_messages keeps anonymous execution revoked', () => {
  assert.match(migration, /revoke all on function public\.chat_dm_list_messages\(uuid,uuid,integer\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.chat_dm_list_messages\(uuid,uuid,integer\) to authenticated/i)
})
