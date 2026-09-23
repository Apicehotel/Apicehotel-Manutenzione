import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('ntfy setup is mounted only inside the RandApp profile area', async () => {
  const [main, profile, setup] = await Promise.all([
    read('../src/main.jsx'),
    read('../src/randapp/Profile.jsx'),
    read('../src/randapp/ntfy/NtfySetup.jsx'),
  ])
  assert.match(profile, /import NtfySetup from '\.\/ntfy\/NtfySetup\.jsx'/)
  assert.match(profile, /<NtfySetup hotelId=\{hotel\?\.id\} notificationCode=\{savedNotificationCode\} \/>/)
  assert.match(profile, /data-testid="notification-code"/)
  assert.doesNotMatch(main, /initNtfyProfileSetup/)
  assert.doesNotMatch(main, /ntfy-profile\.css/)
  assert.match(setup, /data-testid="ntfy-setup"/)
  assert.match(setup, /Configura ntfy/)
})

test('ntfy setup keeps transport isolated and guides iOS Android and desktop', async () => {
  const [setup, client] = await Promise.all([
    read('../src/randapp/ntfy/NtfySetup.jsx'),
    read('../src/randapp/ntfy/ntfy-client.js'),
  ])
  assert.match(setup, /invokeNtfy\('ntfy-config'/)
  assert.match(setup, /invokeNtfy\('ntfy-alert'/)
  assert.match(setup, /iPhone \/ iPad/)
  assert.match(setup, /Android/)
  assert.match(setup, /PC \/ Web/)
  assert.match(setup, /navigator\.clipboard\.writeText/)
  assert.match(setup, /short link RandApp/)
  assert.match(setup, /buildNotificationShortUrl/)
  assert.match(setup, /testChannel/)
  assert.doesNotMatch(setup, />\{channel\.topic\}</)
  assert.doesNotMatch(setup, /clipboard\.writeText\(channel\.topic\)/)
  assert.match(client, /functions\/v1/)
  assert.match(client, /resolveNtfyShortLink/)
  assert.match(client, /invokeNtfyAdmin/)
  assert.match(client, /X-RandApp-Request/)
  assert.match(client, /non è ancora pubblicata/)
  assert.match(client, /NOT_FOUND\|function was not found\|HTTP 404/)
  assert.doesNotMatch(setup + client, /randapp-[A-Za-z0-9_-]{20,}/)
})

test('ntfy edge functions require an authenticated active hotel membership', async () => {
  const [config, alert, resolve] = await Promise.all([
    read('../supabase/functions/ntfy-config/index.ts'),
    read('../supabase/functions/ntfy-alert/index.ts'),
    read('../supabase/functions/ntfy-resolve/index.ts'),
  ])
  for (const src of [config, alert, resolve]) {
    assert.match(src, /client\.auth\.getUser\(\)/)
    assert.match(src, /hotel_memberships/)
    assert.match(src, /membership\?\.active/)
    assert.match(src, /integration_settings/)
    assert.match(src, /ntfy_alerts/)
  }
  assert.match(config, /user_notification_codes/)
  assert.match(config, /notification_code/)
  assert.match(config, /alerts_enabled/)
  assert.match(config, /priority:3/)
  assert.match(resolve, /user_notification_codes/)
  assert.match(resolve, /alias_not_owned/)
  assert.match(resolve, /app_link/)
})

test('admin ntfy console manages enablement without exposing topics in the profile', async () => {
  const [settings, tab, admin, migration] = await Promise.all([
    read('../src/randapp/Settings.jsx'),
    read('../src/randapp/admin/NtfyTab.jsx'),
    read('../supabase/functions/ntfy-admin/index.ts'),
    read('../supabase/migrations/20260923180000_ensure_ntfy_alerts.sql'),
  ])
  assert.match(settings, /NtfyTab/)
  assert.match(settings, /id:'ntfy'/)
  assert.match(tab, /data-testid="ntfy-admin-tab"/)
  assert.match(tab, /invokeNtfyAdmin/)
  assert.match(tab, /Completa topic mancanti/)
  assert.match(tab, /Seleziona struttura ntfy/)
  assert.match(tab, /rs-hotel-toggle/)
  assert.match(tab, /HOTELS/)
  assert.match(admin, /requireAdmin/)
  assert.match(admin, /action === "ensure_topics"/)
  assert.match(admin, /action === "set_enabled"/)
  assert.match(admin, /action === "test_urgent"/)
  assert.doesNotMatch(tab, /config\.topics/)
  assert.doesNotMatch(tab, /randapp-urgent-/)
  assert.match(admin, /topics\?\.\[hotelId\]/)
  assert.match(migration, /ntfy_alerts/)
  assert.match(migration, /where not exists/)
})
