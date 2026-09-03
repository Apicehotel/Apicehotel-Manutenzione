import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { applyHotelIdentity, hotelIdentity, RANDUI_HOTEL_IDENTITIES, RANDUI_IDENTITY_VERSION } from '../src/randapp/hotel-identity.js'
import { EcosystemStatus, getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('93 RandUI remains the single canonical primitive and chrome system', () => {
  const shell = read('../src/randapp/Shell.jsx')
  const main = read('../src/main.jsx')
  assert.match(shell, /from '\.\/ui\.jsx'/)
  assert.equal((shell.match(/<header className="rs-header/g) || []).length, 1)
  assert.equal((shell.match(/<nav className="rs-bottomnav/g) || []).length, 1)
  assert.match(main, /ui-coherence\.css/)
})

test('94 identities are versioned and complete for all canonical hotels', () => {
  assert.equal(RANDUI_IDENTITY_VERSION, 1)
  assert.deepEqual(Object.keys(RANDUI_HOTEL_IDENTITIES).sort(), ['brigantino', 'chocohotel', 'hotelgio'])
  for (const id of Object.keys(RANDUI_HOTEL_IDENTITIES)) {
    const identity = hotelIdentity(id)
    assert.equal(identity.id, id)
    assert.match(identity.accent, /^#[0-9a-f]{6}$/i)
  }
  assert.equal(hotelIdentity('unknown'), null)
  assert.equal(typeof applyHotelIdentity, 'function')
})

test('95 System Light Dark and complete light tokens use one theme contract', () => {
  const theme = read('../src/randapp/theme.js')
  const css = read('../src/randapp/ui-material-glass.css')
  assert.match(theme, /\['system', 'Sistema'\].*\['light', 'Chiaro'\].*\['dark', 'Scuro'\]/s)
  assert.match(theme, /return CHOICES\.includes\(saved\) \? saved : 'system'/)
  for (const token of ['--rs-bg:', '--rs-surface:', '--rs-text:', '--rs-line:', '--rs-accent:']) assert.match(css, new RegExp(token))
})

test('96 adaptive UI covers safe areas, visual viewport, input modes and rotation', () => {
  const adaptive = read('../src/randapp/adaptive-layout.css')
  const coherence = read('../src/randapp/ui-coherence.css')
  const insets = read('../src/randapp/system-insets.js')
  const shell = read('../src/randapp/Shell.jsx')
  assert.match(adaptive, /safe-area-inset/)
  assert.match(coherence, /100dvh/)
  assert.match(coherence, /pointer: coarse/)
  assert.match(coherence, /pointer: fine/)
  assert.match(coherence, /orientation: landscape/)
  assert.match(insets, /visualViewport/)
  assert.match(shell, /useDrawerSwipe/)
})

test('97 visual quality gate is named, cross-engine and fail-closed', () => {
  const ci = read('../.github/workflows/ci.yml')
  const e2e = read('./e2e.mjs')
  const device = read('./device-acceptance.mjs')
  assert.match(ci, /RandUI visual quality contracts/)
  assert.match(ci, /npm run test:randui/)
  assert.match(e2e, /chromium/)
  assert.match(e2e, /webkit/)
  assert.match(e2e, /assertNoHorizontalOverflow/)
  assert.match(e2e, /screenshot/)
  assert.match(device, /touch target/i)
  assert.match(device, /landscape/i)
})

test('97 RandUI becomes LIVE only with implementation and gate evidence', () => {
  const randui = getRandEcosystemManifest().find((item) => item.id === 'randui')
  assert.equal(randui.status, EcosystemStatus.LIVE)
  assert.ok(randui.evidence.includes('test/randai-block25-randui-93-97.test.js'))
  assert.ok(randui.evidence.includes('src/randapp/Shell.jsx'))
})
