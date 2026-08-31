import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { isOfflineSessionFresh, markSessionValidated, MAX_OFFLINE_SESSION_MS } from '../src/session-policy.js'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('offline session is bounded by last server validation', () => {
  const now = 1_800_000_000_000
  assert.equal(isOfflineSessionFresh({ createdAt: now - 1000 }, now), true)
  assert.equal(isOfflineSessionFresh({ lastValidatedAt: now - MAX_OFFLINE_SESSION_MS - 1 }, now), false)
  assert.equal(markSessionValidated({ hotelId: 'hotelgio', userId: 'u1' }, now).lastValidatedAt, now)
})

test('login keeps 4-digit user PIN and 6-digit admin PIN while exposing self-service recovery', async () => {
  const app = await source('src/randapp/App.jsx')
  assert.match(app, /slice\(0, 6\)/)
  assert.match(app, /pin\.length < 6/)
  assert.match(app, /slice\(0, 4\)/)
  assert.match(app, /PIN dimenticato\?/)
  assert.match(app, /PinRecoveryComplete/)
})

test('recovery client never needs the user email', async () => {
  const auth = await source('src/auth-data.js')
  assert.match(auth, /requestPinRecovery\(\{ hotelId, userId \}\)/)
  assert.doesNotMatch(auth, /requestPinRecovery\(\{[^}]*email/)
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
