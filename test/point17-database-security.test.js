import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const hardening = read('supabase/migrations/20260828160000_point17_database_security_hardening.sql')
const performance = read('supabase/migrations/20260828161000_point17_database_performance_hardening.sql')
const point11 = read('supabase/migrations/20260828141000_point11_multihotel_relational_hardening.sql')
const auth = read('src/auth-data.js')
const users = read('src/users-data.js')
const pinAuth = read('supabase/functions/pin-auth/index.ts')
const adminUsers = read('supabase/functions/admin-users/index.ts')

test('point 17 removes anonymous direct SQL access and future default grants', () => {
  assert.match(hardening, /revoke all privileges on all tables in schema public from anon/i)
  assert.match(hardening, /revoke all privileges on all sequences in schema public from anon/i)
  assert.match(hardening, /alter default privileges in schema public revoke all on tables from anon/i)
  assert.match(hardening, /alter default privileges in schema public revoke all on sequences from anon/i)
  assert.match(auth, /functions\.invoke\('pin-auth'/)
  assert.match(auth, /functions\.invoke\('admin-gate'/)
  assert.match(users, /functions\.invoke\('pin-auth'/)
})

test('point 17 service-only tables fail closed for browser roles', () => {
  for (const table of [
    'auth_pin_credentials','edge_function_secrets','integration_settings','notification_outbox',
    'pin_recovery_requests','technician_access_tokens','urgent_reminder_jobs','weather_alert_state',
    'whatsapp_pending_camera','whatsapp_template_status',
  ]) assert.match(hardening, new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`, 'i'))
})

test('point 17 relies on relational hotel integrity instead of a browser-callable definer helper', () => {
  assert.match(point11, /issue_attachments_issue_hotel_fkey/i)
  assert.match(point11, /issue_events_issue_hotel_fkey/i)
  assert.match(point11, /foreign key \(issue_id, hotel_id\) references public\.maintenance_issues\(id, hotel_id\)/i)
  assert.match(hardening, /drop function if exists public\.issue_attachment_same_hotel\(uuid,text\)/i)
  assert.doesNotMatch(hardening, /with check \([^;]*issue_attachment_same_hotel/i)
})

test('point 17 urgent RPCs use the central permission matrix and immutable hotel context', () => {
  assert.match(hardening, /has_app_permission\(p_hotel_id, 'urgent', 'take_charge'\)/i)
  assert.match(hardening, /has_app_permission\(p_hotel_id, 'urgent', 'complete'\)/i)
  assert.match(hardening, /where id=p_id and hotel_id=p_hotel_id and stato='aperta'/i)
  assert.match(hardening, /where id=p_id and hotel_id=p_hotel_id and stato in \('aperta','presa'\)/i)
  const cancellations = hardening.match(/where urgent_id=p_id and hotel_id=p_hotel_id and status in \('pending','processing'\)/gi) || []
  assert.equal(cancellations.length, 2)
  assert.doesNotMatch(hardening, /v_role not in \(/i)
})

test('point 17 exposes privileged operational RPCs only to authenticated/service roles', () => {
  for (const signature of ['public.prendi_urgente(uuid,text,text)','public.completa_urgente(uuid,text,text)','public.get_usage_stats()']) {
    const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(hardening, new RegExp(`revoke execute on function ${escaped} from public, anon`, 'i'))
    assert.match(hardening, new RegExp(`grant execute on function ${escaped} to authenticated, service_role`, 'i'))
  }
})

test('point 17 global usage stats require administration of every active hotel', () => {
  assert.match(hardening, /from public\.hotels h[\s\S]*coalesce\(h\.active,true\)[\s\S]*not public\.can_admin_hotel\(h\.id\)/i)
  assert.match(hardening, /raise exception 'Non autorizzato'/i)
})

test('point 17 PIN auth uses bcrypt, lockout and rotating random Supabase credentials', () => {
  assert.match(adminUsers, /bcrypt\.hash\(pin,11\)/)
  assert.match(pinAuth, /bcrypt\.compare\(pin,credential\.pin_hash\)/)
  assert.match(pinAuth, /failures>=5/)
  assert.match(pinAuth, /10\*60\*1000/)
  const adminPasswords = adminUsers.match(/crypto\.randomUUID\(\)\+crypto\.randomUUID\(\)/g) || []
  const loginPasswords = pinAuth.match(/crypto\.randomUUID\(\)\+crypto\.randomUUID\(\)/g) || []
  assert.ok(adminPasswords.length >= 1)
  assert.ok(loginPasswords.length >= 1)
  assert.match(pinAuth, /admin\.auth\.admin\.updateUserById\(authUserId,\{password\}\)/)
})

test('point 17 covers composite foreign keys and removes exact duplicate indexes', () => {
  for (const index of ['issue_attachments_issue_hotel_idx','issue_events_issue_hotel_idx','promemoria_invio_reminder_hotel_idx','richieste_urgenti_eventi_urgent_hotel_idx','urgent_reminder_jobs_urgent_hotel_idx']) assert.match(performance, new RegExp(`create index if not exists ${index}`, 'i'))
  assert.match(performance, /drop index if exists public\.urgent_events_hotel_created_idx/i)
  assert.match(performance, /drop index if exists public\.tecnici_hotel_idx/i)
})

test('point 17 RLS auth checks use initplans and broad ALL policies are split', () => {
  assert.match(performance, /auth_user_id = \(select auth\.uid\(\)\)/i)
  assert.match(performance, /hm\.auth_user_id = \(select auth\.uid\(\)\)/i)
  assert.doesNotMatch(performance, /create policy .*_write[\s\S]{0,100}for all/i)
  for (const table of ['housekeeping_completions','sale_clients','sale_layouts']) {
    assert.match(performance, new RegExp(`${table}.*permission_insert`, 'i'))
    assert.match(performance, new RegExp(`${table}.*permission_update`, 'i'))
    assert.match(performance, new RegExp(`${table}.*permission_delete`, 'i'))
  }
})
