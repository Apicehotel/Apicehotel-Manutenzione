import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const presence = fs.readFileSync(new URL('../src/randapp/PresenceChip.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/randapp/presence-header.css', import.meta.url), 'utf8')

test('presence uses explicit status sheet instead of direct toggle', () => {
  assert.match(presence, /title="Il tuo stato"/)
  assert.match(presence, /presence-in/)
  assert.match(presence, /presence-out/)
  assert.match(presence, /7h20/)
})

test('presence header is compact and theme-token based', () => {
  assert.match(css, /rs-presence-trigger/)
  assert.match(css, /var\(--rs-text-2\)/)
  assert.match(css, /var\(--rs-surface\)/)
})
