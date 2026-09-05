import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEVICE_CLASS,
  INPUT_MODE,
  ORIENTATION,
  interestScore,
  rankAuthorizedNavigation,
  resolveAdaptiveLayout,
  resolveUserInterests,
} from '../src/randapp/adaptive-layout.js'
import { buildPrimaryBottomNav } from '../src/randapp/shell-navigation.js'

test('adaptive layout classifies desktop, tablet and mobile without tying logic to OS', () => {
  assert.deepEqual(resolveAdaptiveLayout({ width: 1440, height: 900, touch: false, uiSize: 'small' }), {
    device: DEVICE_CLASS.DESKTOP,
    orientation: ORIENTATION.LANDSCAPE,
    input: INPUT_MODE.POINTER,
    density: 'small',
    useSidebar: true,
    useBottomNav: false,
    compactChrome: false,
    touchOptimized: false,
  })
  const tablet = resolveAdaptiveLayout({ width: 820, height: 1180, touch: true, uiSize: 'large' })
  assert.equal(tablet.device, DEVICE_CLASS.TABLET)
  assert.equal(tablet.orientation, ORIENTATION.PORTRAIT)
  assert.equal(tablet.touchOptimized, true)
  assert.equal(tablet.density, 'large')
  const mobile = resolveAdaptiveLayout({ width: 390, height: 844, touch: true, uiSize: 'normal' })
  assert.equal(mobile.device, DEVICE_CLASS.MOBILE)
  assert.equal(mobile.useBottomNav, true)
})

test('Piccolo Normale Grande remain the only density contract with safe fallback', () => {
  assert.equal(resolveAdaptiveLayout({ width: 390, height: 844, uiSize: 'small' }).density, 'small')
  assert.equal(resolveAdaptiveLayout({ width: 390, height: 844, uiSize: 'normal' }).density, 'normal')
  assert.equal(resolveAdaptiveLayout({ width: 390, height: 844, uiSize: 'large' }).density, 'large')
  assert.equal(resolveAdaptiveLayout({ width: 390, height: 844, uiSize: 'giant' }).density, 'normal')
})

test('explicit user interests win over role defaults while role remains a safe fallback', () => {
  assert.deepEqual(resolveUserInterests({ role: 'manutentore', interests: ['Planning', 'Inventory'] }), ['planning', 'inventory'])
  assert.ok(resolveUserInterests({ role: 'reception' }).includes('communications'))
})

test('interest ranking changes priority but never introduces unauthorized entries', () => {
  const authorized = [{ id: 'issues' }, { id: 'inventory' }, { id: 'planning-work' }]
  const ranked = rankAuthorizedNavigation(authorized, ['inventory'])
  assert.equal(ranked[0].id, 'inventory')
  assert.equal(ranked.some((item) => item.id === 'urgent'), false)
  assert.ok(interestScore('inventory', ['inventory']) > interestScore('issues', ['inventory']))
})

test('bottom navigation preserves Operatività, Planning, Home and RandAI anchors while ranking only slot 4', () => {
  const placements = {
    chat: 'off',
    planning_work: 'side',
    inventory: 'bottom',
    supplies: 'side',
    urgent: 'side',
    housekeeping: 'off',
    home: 'bottom',
  }
  const placement = (key) => placements[key] || 'off'
  const allowed = new Set(['operations', 'issues', 'interventions', 'planning-work', 'inventory', 'supplies', 'urgent', 'home'])
  const nav = buildPrimaryBottomNav({ placement, viewAllowed: (id) => allowed.has(id) })

  assert.equal(nav.find((item) => item.slot === 1)?.id, 'operations')
  assert.equal(nav.find((item) => item.slot === 2)?.id, 'planning-work')
  assert.equal(nav.find((item) => item.slot === 3)?.id, 'home')
  assert.equal(nav.find((item) => item.slot === 4)?.id, 'inventory')
  assert.equal(nav.find((item) => item.slot === 5)?.id, 'randai')
  assert.equal(nav.some((item) => item.id === 'housekeeping'), false)
})
