import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { RANDUI_DESIGN_CONTRACT } from '../src/randapp/randui/design-contract.js'
import { RANDUI_ICON_POLICY, RANDUI_SEMANTIC_ICONS, resolveRandUiIcon } from '../src/randapp/randui/icon-contract.js'
import { RANDUI_MOTION, resolveRandUiMotion } from '../src/randapp/randui/motion-contract.js'

const ROOT = new URL('../', import.meta.url)

async function read(relativePath) {
  return readFile(new URL(relativePath, ROOT), 'utf8')
}

test('RandUI has one portable token contract with required foundations', () => {
  const tokens = RANDUI_DESIGN_CONTRACT.tokens
  assert.equal(RANDUI_DESIGN_CONTRACT.version, '1.0.0')
  assert.equal(RANDUI_DESIGN_CONTRACT.standardizationVersion, '1.0.0')
  assert.equal(tokens.space['4'].$value, '16px')
  assert.equal(tokens.radius.md.$value, '16px')
  assert.equal(tokens.layout.touchMin.$value, '44px')
  assert.equal(tokens.motion.duration.standard.$value, '220ms')
  assert.deepEqual(tokens.motion.easing.standard.$value, [0.2, 0, 0, 1])
  assert.equal(RANDUI_DESIGN_CONTRACT.layerOwners.designTokens, 'src/randapp/randui/design-tokens.json')
})

test('RandUI motion is centralized and fails safe for reduced motion', () => {
  assert.equal(RANDUI_MOTION.duration.fast, 160)
  assert.equal(resolveRandUiMotion('standard', { reducedMotion: false }).duration, 220)
  assert.equal(resolveRandUiMotion('emphasis', { reducedMotion: false }).easing, 'cubic-bezier(0.2, 0.8, 0.2, 1)')
  assert.equal(resolveRandUiMotion('standard', { reducedMotion: true }).duration, 0)
  assert.ok(RANDUI_DESIGN_CONTRACT.invariants.includes('one-motion-contract'))
  assert.ok(RANDUI_DESIGN_CONTRACT.invariants.includes('reduced-motion-is-mandatory'))
})

test('RandUI icons have a single semantic adapter contract', () => {
  assert.equal(RANDUI_ICON_POLICY.runtimeOwner, 'src/randapp/ui.jsx#Icon')
  assert.equal(RANDUI_ICON_POLICY.approvedTargetSet, 'mingcute')
  assert.equal(RANDUI_ICON_POLICY.migrationMode, 'adapter-first')
  assert.equal(resolveRandUiIcon('maintenance'), 'wrench')
  assert.equal(resolveRandUiIcon('ai'), 'sparkles')
  assert.ok(Object.keys(RANDUI_SEMANTIC_ICONS).length >= 30)
  assert.ok(RANDUI_DESIGN_CONTRACT.invariants.includes('one-icon-runtime-owner'))
})

test('runtime foundation already protects touch size and reduced motion', async () => {
  const foundation = await read('src/randapp/randui/foundation.css')
  assert.match(foundation, /--rand-touch-min:/)
  assert.match(foundation, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(foundation, /min-width: 0/)
  assert.match(foundation, /max-width: 100%/)
})

test('legacy preview is not treated as zombie while Ocean gate still owns it', async () => {
  const readme = await read('README.md')
  assert.match(readme, /ui-v2-preview/)
  assert.match(readme, /non è zombie|non e zombie/i)
})
