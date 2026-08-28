import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const presence = fs.readFileSync(new URL('../src/randapp/PresenceChip.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/randapp/presence-dot.css', import.meta.url), 'utf8')
const sync = fs.readFileSync(new URL('../src/presence-status.js', import.meta.url), 'utf8')

test('presence is a direct red/green status dot without sheet UI', () => {
  assert.match(presence, /rs-presence-dot-button/)
  assert.match(presence, /data-presence=\{present \? 'in' : 'out'\}/)
  assert.match(presence, /setOwnPresence\(next\)/)
  assert.doesNotMatch(presence, /<Sheet/)
  assert.doesNotMatch(presence, /Il tuo stato/)
})

test('presence dot keeps mobile-size hit target and explicit red-green states', () => {
  assert.match(css, /width: 44px/)
  assert.match(css, /#ef4444/)
  assert.match(css, /#22c55e/)
  assert.match(css, /touch-action: manipulation/)
})

test('presence timeout remains 7h20', () => {
  assert.match(sync, /PRESENCE_MAX_MS = \(7 \* 60 \+ 20\) \* 60 \* 1000/)
})
