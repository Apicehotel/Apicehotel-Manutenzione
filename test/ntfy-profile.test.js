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
  assert.match(setup, /alias RandApp/)
  assert.doesNotMatch(setup, />\{channel\.topic\}</)
  assert.match(client, /functions\/v1/)
  assert.match(client, /X-RandApp-Request/)
  assert.doesNotMatch(setup + client, /randapp-[A-Za-z0-9_-]{20,}/)
})

test('ntfy edge functions require an authenticated active hotel membership', async () => {
  const [config, alert] = await Promise.all([
    read('../supabase/functions/ntfy-config/index.ts'),
    read('../supabase/functions/ntfy-alert/index.ts'),
  ])
  for (const src of [config, alert]) {
    assert.match(src, /client\.auth\.getUser\(\)/)
    assert.match(src, /hotel_memberships/)
    assert.match(src, /membership\?\.active/)
    assert.match(src, /integration_settings/)
    assert.match(src, /ntfy_alerts/)
  }
  assert.match(config, /user_notification_codes/)
  assert.match(config, /notification_code/)
})
