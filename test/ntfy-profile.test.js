import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('ntfy setup is mounted only inside the RandApp profile area', async () => {
  const [main, profile, setup] = await Promise.all([
    read('../src/main.jsx'),
    read('../src/randapp/Profile.jsx'),
    read('../src/randapp/NtfySetup.jsx'),
  ])
  assert.match(profile, /import NtfySetup from '\.\/NtfySetup\.jsx'/)
  assert.match(profile, /<NtfySetup hotelId=\{hotel\?\.id\} \/>/)
  assert.doesNotMatch(main, /initNtfyProfileSetup/)
  assert.doesNotMatch(main, /ntfy-profile\.css/)
  assert.match(setup, /data-testid="ntfy-setup"/)
  assert.match(setup, /Configura ntfy/)
})

test('ntfy setup keeps topics server-side and guides iOS Android and desktop', async () => {
  const setup = await read('../src/randapp/NtfySetup.jsx')
  assert.match(setup, /ntfy-config/)
  assert.match(setup, /ntfy-alert/)
  assert.match(setup, /iPhone \/ iPad/)
  assert.match(setup, /Android/)
  assert.match(setup, /PC \/ Web/)
  assert.match(setup, /navigator\.clipboard\.writeText/)
  assert.match(setup, /test:true/)
  assert.doesNotMatch(setup, /randapp-[A-Za-z0-9_-]{20,}/)
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
})
