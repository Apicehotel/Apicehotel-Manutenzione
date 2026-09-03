import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { assertSensitiveActionOnline, isOfflineSessionFresh, markSessionValidated, MAX_OFFLINE_SESSION_MS } from '../src/session-policy.js'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('offline session is bounded by last server validation', () => {
  const now = 1_800_000_000_000
  assert.equal(isOfflineSessionFresh({ createdAt: now - 1000 }, now), true)
  assert.equal(isOfflineSessionFresh({ lastValidatedAt: now - MAX_OFFLINE_SESSION_MS - 1 }, now), false)
  assert.equal(markSessionValidated({ hotelId: 'hotelgio', userId: 'u1' }, now).lastValidatedAt, now)
})

test('sensitive online guard has a stable security error code', () => {
  const originalNavigator = globalThis.navigator
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
  try {
    assert.throws(() => assertSensitiveActionOnline('Test'), (error) => error?.code === 'ONLINE_REQUIRED')
  } finally {
    if (originalNavigator === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
  }
})

test('login keeps 4-digit user PIN and 6-digit admin PIN while exposing self-service recovery', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /slice\(0, 6\)/)
  assert.match(app, /pin\.length < 6/)
  assert.match(app, /slice\(0, 4\)/)
  assert.match(app, /PIN dimenticato\?/)
  assert.match(app, /PinRecoveryComplete/)
})

test('pre-login directory is minimal while authenticated hotel members keep the operational directory', async () => {
  const edge = await source('supabase/functions/pin-auth/index.ts')
  const client = await source('src/users-data.js')
  const loginEdge = edge.match(/async function listLoginDirectory[\s\S]*?\r?\n}\r?\n\r?\nasync function listOperationalDirectory/)?.[0] || ''
  const loginClient = client.match(/function loginDirectoryUsers[\s\S]*?\r?\n}\r?\nfunction operationalUsers/)?.[0] || ''
  assert.match(loginEdge, /select\("id,nome,active,is_system_protected,hotels"\)/)
  assert.match(loginEdge, /\{id:u\.id,legacy_id:u\.id,name:u\.nome,hotel_id:hotelId,active:true\}/)
  assert.doesNotMatch(loginEdge, /telefono|department|role|can_admin|in_struttura|auth_user_id/)
  assert.match(edge, /activeMember\(req,hotelId\)/)
  assert.match(edge, /listOperationalDirectory\(hotelId\):listLoginDirectory\(hotelId\)/)
  assert.match(loginClient, /legacyId = user\.legacy_id \|\| user\.id/)
  assert.doesNotMatch(loginClient, /phone|department|role|can_admin|in_struttura|auth_user_id/)
  assert.match(client, /fetchLoginDirectory/)
  assert.match(client, /getCachedCollection\('login-directory'/)
  assert.match(client, /getCachedCollection\('directory'/)
})

test('recovery client never needs the user email', async () => {
  const auth = await source('src/auth-data.js')
  assert.match(auth, /requestPinRecovery\(\{ hotelId, userId \}\)/)
  assert.doesNotMatch(auth, /requestPinRecovery\(\{[^}]*email/)
})

test('recovery accepts the saved profile email without requiring email_verified', async () => {
  const edge = await source('supabase/functions/pin-recovery/index.ts')
  assert.match(edge, /profile\?\.email/)
  assert.doesNotMatch(edge, /email_verified/)
})

test('recovery backend is one-time, expiring and excludes protected system accounts', async () => {
  const edge = await source('supabase/functions/pin-recovery/index.ts')
  assert.match(edge, /15 \* 60 \* 1000/)
  assert.match(edge, /token_hash/)
  assert.match(edge, /used_at/)
  assert.match(edge, /bcrypt\.hash/)
  assert.match(edge, /is_system_protected/)
  assert.match(edge, /p_max_attempts: 3/)
  assert.match(edge, /RESEND_API_KEY/)
})

test('RandAI operational gateway explicitly requires connectivity', async () => {
  const gateway = await source('src/randai/action-gateway.js')
  assert.match(gateway, /assertSensitiveActionOnline/)
  assert.match(gateway, /Le azioni operative RandAI/)
})
