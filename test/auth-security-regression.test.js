import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('pin-auth keeps public directory minimal and excludes RandAI', () => {
  const source = read('supabase/functions/pin-auth/index.ts')
  assert.match(source, /\.neq\("ruolo","RandAI"\)/)
  assert.doesNotMatch(source, /legacy\.pin/)
  const directoryBlock = source.slice(source.indexOf('async function listDirectory'), source.indexOf('async function resolveLegacyUserId'))
  for (const forbidden of ['telefono','phone_country_code','in_struttura','auth_user_id','can_admin']) {
    assert.doesNotMatch(directoryBlock, new RegExp(forbidden))
  }
})

test('admin gate has throttling and bcrypt migration', () => {
  const source = read('supabase/functions/admin-gate/index.ts')
  assert.match(source, /MAX_FAILURES\s*=\s*5/)
  assert.match(source, /LOCK_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/)
  assert.match(source, /ADMIN_PANEL_PIN_BCRYPT/)
  assert.match(source, /bcrypt\.hash/)
})

test('Twilio template management requires protected admin', () => {
  const source = read('supabase/functions/setup-whatsapp-template/index.ts')
  assert.match(source, /requireProtectedAdmin/)
  assert.match(source, /is_system_protected/)
  assert.match(source, /ALL_HOTELS\.every/)
})

test('RandAI cannot become generic RandApp admin', () => {
  const source = read('supabase/functions/admin-users/index.ts')
  assert.match(source, /r\.role!=="RandAI"/)
  assert.match(source, /normalizedRole==="RandAI"\?false/)
  const migration = read('supabase/migrations/20260829214501_roadmap21_split_randai_from_randapp_admin.sql')
  assert.match(migration, /m\.role <> 'RandAI'/)
  assert.match(migration, /can_manage_randai_hotel/)
})

test('RandAI is read-only outside dedicated knowledge tables', () => {
  const migration = read('supabase/migrations/20260829215501_roadmap21_randai_least_privilege_and_sensor_isolation.sql')
  assert.match(migration, /set allowed=false where role='RandAI'/)
  assert.match(migration, /action='view'/)
  assert.match(migration, /module in \('home','issues','planning_work','sensors','temperature','users'\)/)
})

test('PIN recovery has source+email throttling', () => {
  const source = read('supabase/functions/pin-recovery/index.ts')
  assert.match(source, /MAX_ATTEMPTS=3/)
  assert.match(source, /WINDOW_MS=30\*60\*1000/)
  assert.match(source, /pin_recovery_rate_limits/)
  assert.match(source, /250-/)
})

test('RandAI UI ships without prefilled default credentials', () => {
  const source = read('src/randai/auth/RandAIProtectedRoute.jsx')
  assert.doesNotMatch(source, /00000000/)
  assert.match(source, /useState\(''\),\[password,setPassword\]=useState\(''\)/)
})
