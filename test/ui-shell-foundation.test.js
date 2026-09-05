import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPrimaryBottomNav, PRIMARY_OPERATIONAL_NAV } from '../src/randapp/shell-navigation.js'
import { applySystemInsets, clearSystemInsets } from '../src/randapp/system-insets.js'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const allBottom = (key) => key === 'other' || key === 'home' || PRIMARY_OPERATIONAL_NAV.some((item) => item.key === key) ? 'bottom' : 'off'
const allAllowed = () => true

test('adaptive primary mobile navigation keeps five structural slots with Home in slot 3 and Altro in slot 5', () => {
  assert.ok(PRIMARY_OPERATIONAL_NAV.length >= 3)
  const nav = buildPrimaryBottomNav({ placement: allBottom, viewAllowed: allAllowed })

  assert.equal(nav.length, 5)
  assert.deepEqual(nav.map(({ slot }) => slot), [1, 2, 3, 4, 5])
  assert.equal(nav.find((item) => item.id === 'home')?.slot, 3)
  assert.equal(nav.find((item) => item.id === 'menu')?.slot, 5)
})

test('permissions may hide a destination without moving Home or Altro anchors', () => {
  const nav = buildPrimaryBottomNav({
    placement: allBottom,
    viewAllowed: (id) => id !== 'interventions',
  })

  assert.equal(nav.some((item) => item.id === 'interventions'), false)
  assert.equal(nav.find((item) => item.id === 'home')?.slot, 3)
  assert.equal(nav.find((item) => item.id === 'menu')?.slot, 5)
})

test('adaptive App Shell CSS uses effective browser/native insets and never caps bottom inset', async () => {
  const css = await read('src/randapp/adaptive-layout.css')
  assert.match(css, /--rs-native-safe-bottom:\s*0px/)
  assert.match(css, /--rs-adaptive-safe-bottom:\s*max\(env\(safe-area-inset-bottom, 0px\), var\(--rs-native-safe-bottom\)\)/)
  assert.doesNotMatch(css, /min\(env\(safe-area-inset-bottom/)
  assert.match(css, /grid-template-columns:\s*repeat\(5,/)
  assert.match(css, /\.rs-navbtn\[data-slot='3'\]\s*\{\s*grid-column:\s*3;/)
  assert.match(css, /\.rs-navbtn\[data-slot='5'\]\s*\{\s*grid-column:\s*5;/)
  assert.match(css, /@media \(min-width:\s*1200px\)/)
  assert.match(css, /\.rs-bottomnav, \.rs-navfab \{ display: none; \}/)
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

test('Shell and document keep the adaptive PWA/native-ready navigation contract wired', async () => {
  const [shell, html, main] = await Promise.all([
    read('src/randapp/Shell.jsx'),
    read('index.html'),
    read('src/main.jsx'),
  ])
  assert.match(shell, /buildPrimaryBottomNav/)
  assert.match(shell, /resolveUserInterests/)
  assert.match(shell, /initSystemInsetsBridge/)
  assert.match(shell, /data-count="5"/)
  assert.match(shell, /data-slot=\{item\.slot\}/)
  assert.match(shell, /aria-label="Navigazione principale"/)
  assert.match(main, /import ['"]\.\/randapp\/adaptive-layout\.css['"]/)
  assert.doesNotMatch(shell, /app-shell-foundation\.css/)
  assert.match(html, /viewport-fit=cover/)
  assert.doesNotMatch(html, /rs-bottomnav\[data-count=/)
})
