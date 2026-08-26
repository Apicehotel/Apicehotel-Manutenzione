import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const settings = await readFile(new URL('../src/randapp/Settings.jsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20260826143000_fix_giulia_head_housekeeper_and_scope.sql', import.meta.url), 'utf8')

test('housekeepers are grouped by hotel instead of one global role bucket', () => {
  assert.match(settings, /Housekeeping · \${hotel\.short}/)
  assert.match(settings, /housekeepingRoles = new Set\(\['Governante', 'Capo Governante'\]\)/)
  assert.match(settings, /\(u\.hotels \|\| \[\]\)\.includes\(hotel\.id\)/)
})

test('Giulia head-housekeeper migration accepts full display names and scopes Hotel Gio only', () => {
  assert.match(migration, /hm\.hotel_id = 'hotelgio'/)
  assert.match(migration, /set role = 'Capo Governante'/)
  assert.match(migration, /\^giulia\(\?:\\s\|\$\)/)
  assert.doesNotMatch(migration, /hm\.hotel_id = 'chocohotel'/)
  assert.doesNotMatch(migration, /hm\.hotel_id = 'brigantino'/)
})
