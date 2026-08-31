import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const presence = fs.readFileSync(new URL('../src/randapp/PresenceChip.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/randapp/presence-dot.css', import.meta.url), 'utf8')
const headerCss = fs.readFileSync(new URL('../src/randapp/header-mobile.css', import.meta.url), 'utf8')
const sync = fs.readFileSync(new URL('../src/presence-status.js', import.meta.url), 'utf8')

test('presence is a direct labeled hotel-scoped pill without sheet UI', () => {
  assert.match(presence, /className="rs-presence-chip"/)
  assert.match(presence, /data-testid="presence-chip"/)
  assert.match(presence, /data-presence=\{present \? 'in' : 'out'\}/)
  assert.match(presence, /data-here=\{presentHere \? 'true' : 'false'\}/)
  assert.match(presence, /setOwnPresence\(next, next \? activeHotel\.id : null\)/)
  assert.match(presence, /visibleLabel/)
  assert.doesNotMatch(presence, /<Sheet/)
  assert.doesNotMatch(presence, /Il tuo stato/)
})

test('presence pill stays touch-safe and exposes distinct out here and other-hotel states', () => {
  assert.match(css, /touch-action: manipulation/)
  assert.match(css, /min-height: calc\(40px \* var\(--rs-scale\)\)/)
  assert.match(css, /background: #94a3b8/)
  assert.match(css, /background: #22c55e/)
  assert.match(css, /data-presence='in'\]\[data-here='false'/)
  assert.match(css, /background: #f59e0b/)
})

test('presence and bell share the same scaled mobile header action geometry', () => {
  assert.match(headerCss, /--rs-header-action-size:/)
  assert.match(headerCss, /\[data-testid='presence-chip'\][\s\S]*height: var\(--rs-header-action-size\)/)
  assert.match(headerCss, /\[data-testid='header-notifications'\][\s\S]*width: var\(--rs-header-action-size\)/)
  assert.match(headerCss, /calc\(21px \* var\(--rs-scale\)\)/)
})

test('presence timeout remains 7h20', () => {
  assert.match(sync, /PRESENCE_MAX_MS = \(7 \* 60 \+ 20\) \* 60 \* 1000/)
})
