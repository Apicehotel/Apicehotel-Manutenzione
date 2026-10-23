import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8')

test('sensor season migration keeps settings protected and realtime-ready', () => {
  const sql = read('supabase/migrations/20261023143000_sensor_season_rules.sql')
  assert.match(sql, /create table if not exists public\.sensori_impostazioni/)
  assert.match(sql, /stagione text not null default 'inverno'/)
  assert.match(sql, /alter table public\.sensori_impostazioni enable row level security/)
  assert.match(sql, /sensori_impostazioni_admin_update/)
  assert.match(sql, /hm\.can_access_admin = true/)
  assert.match(sql, /alter publication supabase_realtime add table public\.sensori_impostazioni/)
  for (const deviceId of ['1001e22b8d', '10025339c4', '1001e22ba7', '1002534102', '10025340a7', '10023c8674', '1002534089']) {
    assert.match(sql, new RegExp(deviceId))
  }
})

test('sensor sync applies season and role-specific thresholds server-side', () => {
  const source = read('supabase/functions/sync-sensori-temperatura/index.ts')
  assert.doesNotMatch(source, /const SOGLIA\s*=\s*20/)
  assert.match(source, /sensori_impostazioni\?id=eq\.1/)
  assert.match(source, /role === "motore" && rules\.stagione === "inverno"/)
  assert.match(source, /role === "motore" && rules\.stagione === "estate"/)
  assert.match(source, /role === "frigo"/)
  assert.match(source, /allerta_tipo: alert\.allerta_tipo/)
  assert.match(source, /\n        ruolo,\r?\n/)
})

test('temperature UI exposes season changes only for admin-capable users', () => {
  const source = read('src/temperature.jsx')
  assert.match(source, /sensori_impostazioni/)
  assert.match(source, /can_access_admin \|\| user\?\.canAdmin \|\| user\?\.can_admin/)
  assert.match(source, /update\(\{ stagione: season/)
  assert.match(source, /Gli alert verranno ricalcolati al prossimo sync/)
})
