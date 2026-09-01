import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPrimaryBottomNav, PRIMARY_BOTTOM_NAV } from '../src/randapp/shell-navigation.js'
import { applySystemInsets, clearSystemInsets } from '../src/randapp/system-insets.js'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('primary mobile navigation keeps five visible slots with Home in slot 3 and Menu gesture-only', () => {
  assert.deepEqual(PRIMARY_BOTTOM_NAV.map(({ slot, id }) => [slot, id]), [
    [1, 'issues'],
    [2, 'interventions'],
    [3, 'home'],
    [4, 'planning-work'],
    [5, 'inventory'],
    [6, 'menu'],
  ])
  assert.equal(PRIMARY_BOTTOM_NAV.find((item) => item.id === 'menu')?.gestureOnly, true)

  const nav = buildPrimaryBottomNav({ placement: () => 'bottom', viewAllowed: () => true })
  assert.equal(nav.length, 6)
  assert.equal(nav.find((item) => item.id === 'home')?.slot, 3)
  assert.equal(nav.find((item) => item.id === 'inventory')?.slot, 5)
})

test('permissions may hide a destination without moving Home away from slot 3', () => {
  const nav = buildPrimaryBottomNav({
    placement: (key) => key === 'interventions' ? 'off' : 'bottom',
    viewAllowed: () => true,
  })
  assert.deepEqual(nav.map(({ slot }) => slot), [1, 3, 4, 5, 6])
  assert.equal(nav.find((item) => item.id === 'home')?.slot, 3)
})

test('App Shell CSS uses effective browser/native insets and five visible columns', async () => {
  const css = await read('src/randapp/app-shell-foundation.css')
  assert.match(css, /--rs-native-safe-bottom:\s*0px/)
  assert.match(css, /--rs-safe-bottom:\s*max\(env\(safe-area-inset-bottom, 0px\), var\(--rs-native-safe-bottom\)\)/)
  assert.doesNotMatch(css, /min\(env\(safe-area-inset-bottom/)
  assert.match(css, /grid-template-columns:\s*repeat\(5,/)
  assert.match(css, /\.rs-navbtn\[data-slot='3'\]\s*\{\s*grid-column:\s*3;/)
  assert.match(css, /\.rs-navbtn\[data-slot='6'\]/)
  assert.match(css, /clip-path:\s*inset\(50%\)/)
})

test('native inset bridge writes and clears CSS variables for a future Android wrapper', () => {
  const values = new Map()
  const previousDocument = global.document
  global.document = {
    documentElement: {
      dataset: {},
      style: {
        setProperty: (name, value) => values.set(name, value),
        removeProperty: (name) => values.delete(name),
      },
    },
  }

  try {
    applySystemInsets({ top: 24, right: 0, bottom: 48, left: 0 })
    assert.equal(values.get('--rs-native-safe-top'), '24px')
    assert.equal(values.get('--rs-native-safe-bottom'), '48px')
    assert.equal(global.document.documentElement.dataset.systemInsets, 'native')
    clearSystemInsets()
    assert.equal(values.has('--rs-native-safe-bottom'), false)
  } finally {
    global.document = previousDocument
  }
})

test('Shell and document keep the PWA/native-ready navigation contract wired', async () => {
  const [shell, html, swipe] = await Promise.all([
    read('src/randapp/Shell.jsx'),
    read('index.html'),
    read('src/randapp/swipe-navigation.js'),
  ])
  assert.match(shell, /buildPrimaryBottomNav/)
  assert.match(shell, /initSystemInsetsBridge/)
  assert.match(shell, /data-count="5"/)
  assert.match(shell, /data-slot=\{item\.slot\}/)
  assert.match(shell, /aria-label="Navigazione principale"/)
  assert.match(swipe, /nav-menu/)
  assert.match(swipe, /touchstart/)
  assert.match(swipe, /touchend/)
  assert.match(html, /viewport-fit=cover/)
  assert.doesNotMatch(html, /rs-bottomnav\[data-count=/)
})
