import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('push client verifies subscription per hotel and repairs on hotel change', async () => {
  const push = await readFile(new URL('../src/push.js', import.meta.url), 'utf8')
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  assert.match(push, /action: 'status'/)
  assert.match(push, /unsubscribe_browser/)
  assert.match(push, /export async function repairPushSubscription/)
  assert.match(push, /requiresHomeScreen: ios && !standalone/)
  assert.match(main, /apice-session-changed/)
  assert.match(main, /repairPushSubscription/)
})

test('profile exposes native RandApp push activation independently from ntfy', async () => {
  const profile = await readFile(new URL('../src/randapp/Profile.jsx', import.meta.url), 'utf8')
  assert.match(profile, /data-testid="profile-push-notifications"/)
  assert.match(profile, /Notifiche push RandApp/)
  assert.match(profile, /subscribeToPush\(hotel\.id\)/)
  assert.match(profile, /unsubscribeFromPush\(hotel\.id\)/)
  assert.match(profile, /Attiva notifiche push/)
  assert.match(profile, /Disattiva notifiche push/)
  assert.match(profile, /ntfy resta un canale separato/i)
})

test('push unsubscribe is scoped to current user, hotel and endpoint', async () => {
  const fn = await readFile(new URL('../supabase/functions/push-subscribe/index.ts', import.meta.url), 'utf8')
  assert.match(fn, /action === "unsubscribe"/)
  assert.match(fn, /\.eq\("hotel_id", hotel\)\.eq\("utente", userData\.user\.id\)\.eq\("endpoint", subscription\.endpoint\)/)
  assert.match(fn, /unsubscribe_browser/)
})

test('service worker preserves notification destination on existing PC/mobile window', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(sw, /const CACHE_NAME = 'apicehotel-manutenzione-v\d+'/)
  assert.match(sw, /await existing\.navigate\(targetUrl\)/)
  assert.match(sw, /type: 'notification-click'/)
  assert.match(sw, /hotelId: payload\.hotelId/)
})

test('send-push validates issue against DB, deduplicates and includes hotel context', async () => {
  const fn = await readFile(new URL('../supabase/functions/send-push/index.ts', import.meta.url), 'utf8')
  assert.match(fn, /HOTEL_NAMES/)
  assert.match(fn, /issue_not_found/)
  assert.match(fn, /status: "deduplicated"/)
  assert.match(fn, /new Map\(subs\.map/)
  assert.match(fn, /notification=issue_created/)
  assert.match(fn, /hotelId: hotel/)
})
