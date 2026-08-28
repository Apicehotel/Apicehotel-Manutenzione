import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260828133500_point10_housekeeping_consolidation.sql','utf8')
const backfill = fs.readFileSync('supabase/migrations/20260828134500_point10_housekeeping_history_backfill.sql','utf8')
const history = fs.readFileSync('src/housekeeping-v3.jsx','utf8')
const entry = fs.readFileSync('src/housekeeping.jsx','utf8')

test('housekeeping import is idempotent per hotel and day',()=>{
  assert.match(migration,/import_camere_idempotent_idx/)
  assert.match(migration,/hotel_id, work_date, payload_hash/)
  assert.match(migration,/if v_existing_import is not null then\s+return v_existing_import/i)
  assert.doesNotMatch(migration,/delete from public\.camere_giorno where hotel_id = p_hotel_id/i)
  assert.doesNotMatch(migration,/delete from public\.camere_lavoro where hotel_id = p_hotel_id/i)
})

test('housekeeping preserves same-day work and resets only on a new work date',()=>{
  assert.match(migration,/camere_lavoro\.work_date is distinct from current_date/)
  assert.match(migration,/else public\.camere_lavoro\.stato/)
})

test('housekeeping keeps immutable import versions and daily snapshots',()=>{
  assert.match(migration,/create table if not exists public\.housekeeping_daily_rooms/)
  assert.match(migration,/primary key \(hotel_id, work_date, camera\)/)
  assert.match(migration,/create table if not exists public\.housekeeping_import_rooms/)
  assert.match(migration,/primary key \(import_id, camera\)/)
  assert.match(backfill,/Europe\/Rome/)
})

test('housekeeping validates duplicate rooms and canonical states server-side',()=>{
  assert.match(migration,/Il file contiene camere duplicate/)
  assert.match(migration,/b2b','partenza','arrivo','fermata','libera/)
  assert.match(migration,/Numero camere non valido/)
})

test('housekeeping upload authorization is hotel-scoped',()=>{
  assert.match(migration,/hm\.hotel_id = p_hotel_id/)
  assert.match(migration,/hm\.active = true/)
  assert.match(migration,/hm\.role in \('admin','Direzione','Reception'\)/)
})

test('housekeeping history UI always filters by selected hotel and work date',()=>{
  assert.match(history,/\.eq\('hotel_id',hotel\.id\)/)
  assert.match(history,/\.eq\('work_date',selectedDate\)/)
  assert.match(history,/Storico giornaliero/)
  assert.match(history,/struttura/)
  assert.match(history,/piano/)
  assert.match(entry,/housekeeping-v3\.jsx/)
})
