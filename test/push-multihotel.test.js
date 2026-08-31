import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('push client verifies and repairs subscription for the signed-in person, not the open hotel', async () => {
  const push = await readFile(new URL('../src/push.js', import.meta.url), 'utf8')
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
  assert.match(push, /action: 'status'/)
  assert.match(push, /export async function repairPushSubscription\(\)/)
  assert.match(push, /requiresHomeScreen: ios && !standalone/)
  assert.doesNotMatch(push, /hotel_id:/)
  assert.doesNotMatch(push, /currentHotelId/)
  assert.match(main, /lastRepairUserId/)
  assert.match(main, /repairPushSubscription\(\)/)
  assert.doesNotMatch(main, /lastRepairHotelId/)
})

test('profile exposes personal native RandApp push activation independently from hotel and ntfy', async () => {
  const profile = await readFile(new URL('../src/randapp/Profile.jsx', import.meta.url), 'utf8')
  assert.match(profile, /data-testid="profile-push-notifications"/)
  assert.match(profile, /Push personali su questo dispositivo/)
  assert.match(profile, /subscribeToPush\(\)/)
  assert.match(profile, /unsubscribeFromPush\(\)/)
  assert.match(profile, /strutture e i permessi del tuo profilo/)
  assert.doesNotMatch(profile, /subscribeToPush\(hotel\.id\)/)
  assert.doesNotMatch(profile, /unsubscribeFromPush\(hotel\.id\)/)
  assert.match(profile, /ntfy resta un canale separato/i)
})

test('push subscription backend binds one device to the person and mirrors active memberships only for routing', async () => {
  const fn = await readFile(new URL('../supabase/functions/push-subscribe/index.ts', import.meta.url), 'utf8')
  assert.match(fn, /action === "unsubscribe"/)
  assert.match(fn, /\.delete\(\)\.eq\("utente", userData\.user\.id\)\.eq\("endpoint", subscription\.endpoint\)/)
  assert.match(fn, /hotel_memberships/)
  assert.match(fn, /\.eq\("auth_user_id", userData\.user\.id\)/)
  assert.match(fn, /\.eq\("active", true\)/)
  assert.match(fn, /const rows = hotelIds\.map/)
  assert.match(fn, /l'utente attiva\/disattiva il proprio dispositivo una volta/)
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
