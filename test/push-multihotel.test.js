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
