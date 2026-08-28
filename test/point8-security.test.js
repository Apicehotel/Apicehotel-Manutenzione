import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260828075500_point8_security_hardening.sql')
const diagnostics = read('src/diagnostics-client.js')
const publicIssue = read('supabase/functions/public-iss/index.ts')
const vercel = read('vercel.json')
const ci = read('.github/workflows/ci.yml')

test('point 8: sensitive service tables are not directly exposed to browser roles', () => {
  for (const table of ['push_subscriptions', 'technician_access_tokens', 'whatsapp_pending_camera', 'whatsapp_template_status']) {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, 'i'))
  }
})

test('point 8: urgent audit events and sensors are isolated by membership/admin policy', () => {
  assert.match(migration, /urgent_events_member_select/i)
  assert.match(migration, /is_hotel_member\(hotel_id\)/i)
  assert.doesNotMatch(migration, /create policy urgent_events_.*with check\s*\(true\)/i)
  assert.match(migration, /sensori_temperatura_member_select/i)
  assert.match(migration, /hm\.hotel_id = 'gio' and mostra_hotelgio/i)
  assert.match(migration, /hm\.hotel_id = 'chocohotel' and mostra_chocohotel/i)
  assert.match(migration, /hm\.hotel_id = 'brigantino' and mostra_brigantino/i)
  assert.match(migration, /sensori_temperatura_admin_update/i)
})

test('point 8: diagnostics redact secrets before local or remote persistence', () => {
  assert.match(diagnostics, /export function redactDiagnosticText/)
  assert.match(diagnostics, /Bearer \[REDACTED\]/)
  assert.match(diagnostics, /JWT REDACTED/)
  assert.match(diagnostics, /SUPABASE KEY REDACTED/)
  assert.match(diagnostics, /password\|passwd\|pin/)
  assert.match(diagnostics, /message: crop\(redactDiagnosticText\(message\)/)
  assert.match(diagnostics, /detail: crop\(redactDiagnosticText\(detail\)/)
})

test('point 8: public issue endpoint minimizes token lifetime and backend disclosure', () => {
  assert.match(publicIssue, /const UUID =/)
  assert.match(publicIssue, /createSignedUrl\(row\.foto_prima, 60 \* 15\)/)
  assert.match(publicIssue, /Servizio temporaneamente non disponibile/)
  assert.doesNotMatch(publicIssue, /return json\(\{ ok: false, error: message \}/)
})

test('point 8: production headers and dependency audit are permanent gates', () => {
  for (const header of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options', 'Content-Security-Policy', 'Strict-Transport-Security']) {
    assert.match(vercel, new RegExp(header))
  }
  assert.match(vercel, /frame-ancestors 'none'/)
  assert.match(ci, /npm audit --audit-level=high/)
})

test('point 8: cross-hotel usage statistics require an administrator', () => {
  assert.match(migration, /create or replace function public\.get_usage_stats\(\)/i)
  assert.match(migration, /hm\.can_access_admin/i)
  assert.match(migration, /raise exception 'Non autorizzato'/i)
  assert.match(migration, /revoke execute on function public\.get_usage_stats\(\) from public, anon/i)
})
