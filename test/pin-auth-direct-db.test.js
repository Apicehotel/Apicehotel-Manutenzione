import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pinAuth = fs.readFileSync(new URL('../supabase/functions/pin-auth/index.ts', import.meta.url), 'utf8')

test('pin-auth bypasses PostgREST for privileged database work', () => {
  assert.match(pinAuth, /npm:postgres@3\.4\.7/)
  assert.match(pinAuth, /SUPABASE_DB_URL/)
  assert.doesNotMatch(pinAuth, /createAdminClient/)
  assert.doesNotMatch(pinAuth, /\.from\(/)
})

test('pin-auth keeps secret and publishable API keys out of Authorization bearer fallback', () => {
  assert.match(pinAuth, /SUPABASE_SECRET_KEYS/)
  assert.match(pinAuth, /SUPABASE_PUBLISHABLE_KEYS/)
  assert.match(pinAuth, /headers:\s*Record<string,string>\s*=\s*\{apikey:key/)
  assert.match(pinAuth, /if\(token\) headers\.Authorization=/)
})

test('pin-auth issues sessions through Auth while direct Postgres owns identity tables', () => {
  assert.match(pinAuth, /\/admin\/users/)
  assert.match(pinAuth, /\/token\?grant_type=password/)
  assert.match(pinAuth, /public\.auth_pin_credentials/)
  assert.match(pinAuth, /public\.hotel_memberships/)
  assert.match(pinAuth, /public\.profiles/)
  assert.match(pinAuth, /public\.utenti/)
})
