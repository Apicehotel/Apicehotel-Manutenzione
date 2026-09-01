import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260828141000_point11_multihotel_relational_hardening.sql','utf8')
const offline = fs.readFileSync('src/offline-store.js','utf8')

test('operational tables require hotel ownership',()=>{
  assert.match(migration,/tecnici alter column hotel_id set not null/i)
  assert.match(migration,/notification_outbox alter column hotel_id set not null/i)
  for (const table of ['promemoria','notification_reads','diagnostic_events','sale_rooms_config','sale_clients','sale_layouts_config','richieste_urgenti_eventi','urgent_reminder_jobs','weather_alert_state']) {
    assert.match(migration,new RegExp(`${table}_hotel_id_fkey`))
  }
})

test('critical child rows cannot cross hotel boundaries',()=>{
  assert.match(migration,/issue_attachments_issue_hotel_fkey/)
  assert.match(migration,/issue_events_issue_hotel_fkey/)
  assert.match(migration,/richieste_urgenti_eventi_urgent_hotel_fkey/)
  assert.match(migration,/urgent_reminder_jobs_urgent_hotel_fkey/)
  assert.match(migration,/promemoria_invio_reminder_hotel_fkey/)
})

test('planning day rows are explicitly hotel scoped and centrally authorized',()=>{
  assert.match(migration,/planning_lavori_giorni add column if not exists hotel_id/)
  assert.match(migration,/Cross-hotel planning non consentito/)
  assert.match(migration,/has_app_permission\(hotel_id,'planning_work','view'\)/)
  assert.match(migration,/has_app_permission\(hotel_id,'planning_work','complete'\)/)
  assert.doesNotMatch(migration,/has_hotel_role\(p\.hotel_id/)
})

test('notification reads remain scoped to current membership',()=>{
  assert.match(migration,/notification_reads_select_own_hotel/)
  assert.match(migration,/user_id=auth\.uid\(\) and public\.is_hotel_member\(hotel_id\)/)
})

test('offline cache and outbox carry immutable hotel context and stable operation identity',()=>{
  assert.match(offline,/cacheKey = \(entity, hotelId\) => `\$\{entity\}:\$\{hotelId\}`/)
  assert.match(offline,/if \(!hotelId\) throw new Error\(`hotelId mancante/)
  assert.match(offline,/stableOperationId = operationId \|\| createOfflineOperationId\(\)/)
  assert.match(offline,/const op = \{ operationId:stableOperationId, entity, hotelId, action/)
  assert.match(offline,/op\.hotelId/)
  assert.match(offline,/op\.operationId/)
})
