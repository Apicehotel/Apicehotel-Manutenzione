import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { evaluateSensorAlert } from '../supabase/functions/_shared/sensor-alert-rules.js'
import { saveSensorSeason } from '../src/sensor-settings-data.js'

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
  assert.match(source, /from public\.sensori_impostazioni where id = 1/)
  assert.match(source, /evaluateSensorAlert\(roles\.get\(id\)/)
  assert.match(source, /soglia = excluded\.soglia/)
  assert.match(source, /allerta_tipo = excluded\.allerta_tipo/)
  assert.doesNotMatch(source, /mostra_hotelgio = excluded|ruolo = excluded/)
})

test('temperature UI exposes season changes only for admin-capable users', () => {
  const source = read('src/temperature.jsx')
  assert.match(source, /sensori_impostazioni/)
  assert.match(source, /can_access_admin \|\| user\?\.canAdmin \|\| user\?\.can_admin/)
  assert.match(source, /saveSensorSeason\(sensorsClient, season\)/)
  assert.match(source, /aria-pressed=\{settings\?\.stagione === season\}/)
  assert.match(source, /seasonNotice && <span>/)
})

const rules = { stagione: 'inverno', soglia_inverno_min: 20, soglia_estate_max: 18, soglia_frigo_max: 0 }
test('season switch reverses motor thresholds, preserves exact boundaries and refrigerator rules', () => {
  assert.equal(evaluateSensorAlert('motore', 17, true, rules).in_allerta, true)
  assert.equal(evaluateSensorAlert('motore', 17, true, { ...rules, stagione: 'estate' }).in_allerta, false)
  assert.equal(evaluateSensorAlert('motore', 21, true, { ...rules, stagione: 'estate' }).in_allerta, true)
  assert.equal(evaluateSensorAlert('motore', 20, true, rules).in_allerta, false)
  assert.equal(evaluateSensorAlert('motore', 18, true, { ...rules, stagione: 'estate' }).in_allerta, false)
  for (const stagione of ['estate', 'inverno']) assert.equal(evaluateSensorAlert('frigo', 1, true, { ...rules, stagione }).in_allerta, true)
  for (const [role, temp, online] of [['ambiente', 50, true], ['motore', null, true], ['motore', NaN, true], ['motore', 10, false]]) {
    assert.deepEqual(evaluateSensorAlert(role, temp, online, rules), { in_allerta: false, soglia: null, allerta_tipo: null })
  }
})

function settingsClient(result) {
  return { from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: async () => result }) }) }) }) }
}
test('season saving requires a confirmed returned row, not just an UPDATE without errors', async () => {
  const saved = { id: 1, ...rules, stagione: 'estate' }
  assert.deepEqual(await saveSensorSeason(settingsClient({ data: saved }), 'estate'), saved)
  await assert.rejects(saveSensorSeason(settingsClient({ data: null }), 'estate'), /non salvata/)
  await assert.rejects(saveSensorSeason(settingsClient({ error: { code: '42501' } }), 'estate'), /non salvata/)
  await assert.rejects(saveSensorSeason(settingsClient({ data: { ...rules } }), 'estate'), /non salvata/)
  await assert.rejects(saveSensorSeason(settingsClient({ data: saved }), 'other'), /non valida/)
})
