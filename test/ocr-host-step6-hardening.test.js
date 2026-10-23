import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('supabase client is fail-closed without VITE_* (no hardcoded prod fallback)', () => {
  const supabase = read('src/supabase.js')
  const envDev = read('.env.development')
  const dockerfile = read('Dockerfile.ocean')
  const ci = read('.github/workflows/ci.yml')
  assert.doesNotMatch(supabase, /ooqlfldcrnkudhgjnied\.supabase\.co/)
  assert.doesNotMatch(supabase, /sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX/)
  assert.match(supabase, /VITE_SUPABASE_URL/)
  assert.match(supabase, /VITE_SUPABASE_ANON_KEY/)
  assert.match(supabase, /client non configurato/)
  assert.match(envDev, /VITE_SUPABASE_URL=https:\/\/ooqlfldcrnkudhgjnied\.supabase\.co/)
  assert.match(dockerfile, /ARG VITE_SUPABASE_URL=/)
  assert.match(dockerfile, /ARG VITE_SUPABASE_ANON_KEY=/)
  assert.match(ci, /VITE_SUPABASE_URL:/)
  assert.match(ci, /VITE_SUPABASE_ANON_KEY:/)
})

test('legacy technician access tokens carry expires_at and resolve rejects expired', () => {
  const migration = read('supabase/migrations/20261010094000_technician_access_token_expires_at.sql')
  const portal = read('supabase/functions/tech-portal/index.ts')
  const admin = read('supabase/functions/admin-users/index.ts')
  assert.match(migration, /add column if not exists expires_at/)
  assert.match(migration, /interval '90 days'/)
  assert.match(portal, /expires_at/)
  assert.match(portal, /new Date\(row\.expires_at\)\.getTime\(\) <= Date\.now\(\)/)
  assert.match(admin, /expires_at:expiresAt/)
  assert.match(admin, /90\*24\*60\*60\*1000/)
})

test('public-iss rejects legacy UUID share links with 410', () => {
  const edge = read('supabase/functions/public-iss/index.ts')
  assert.match(edge, /legacy_uuid_disabled/)
  assert.match(edge, /410/)
  assert.match(edge, /\.eq\("public_share_token", raw\)/)
  assert.doesNotMatch(edge, /query\.eq\("id", raw\)/)
})

test('inventory QR requires hotel membership and hotel-scoped deep links', () => {
  const edge = read('supabase/functions/inventory-qr-label/index.ts')
  const data = read('src/inventory-block2-data.js')
  const ui = read('src/randapp/InventoryBlock2Panel.jsx')
  assert.match(edge, /hotel_memberships/)
  assert.match(edge, /KNOWN_HOTELS/)
  assert.match(edge, /hotel_mismatch/)
  assert.match(edge, /forbidden/)
  assert.match(data, /getInventoryQrSvg\(text, hotelId\)/)
  assert.match(data, /hotel_id: resolvedHotel/)
  assert.match(ui, /getInventoryQrSvg\(inventoryDeepLink\(hotel\.id, item\.scanCode\), hotel\.id\)/)
})

test('overlay chrome offsets prefer RandUI nav-row tokens', () => {
  const offline = read('src/offline-status.css')
  const feedback = read('src/operation-feedback.css')
  const next = read('src/randapp/randui-next.css')
  const onboarding = read('src/randapp/notification-onboarding.css')
  assert.match(offline, /--rnx-nav-row/)
  assert.match(feedback, /--rnx-nav-row/)
  assert.match(onboarding, /--rnx-nav-row/)
  assert.match(next, /\.rnx-fab\{[^}]*var\(--rnx-safe-bottom\)/)
})
