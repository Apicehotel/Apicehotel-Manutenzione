import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('executable dock loads LiquidGlass material, dock geometry and final layout in order', async () => {
  const main = await source('src/main.jsx')
  const vendorIndex = main.indexOf("./randapp/vendor/liquid-glass-ui.css")
  const dockIndex = main.indexOf("./randapp/prototype-liquid-dock.css")
  const finalIndex = main.indexOf("./randapp/randapp-final-layout.css")
  assert.ok(vendorIndex >= 0, 'LiquidGlass UI vendor stylesheet must be loaded')
  assert.ok(dockIndex > vendorIndex, 'Dock geometry must load after LiquidGlass material')
  assert.ok(finalIndex > dockIndex, 'Final app layout must load last')
})

test('mobile dock uses real RandApp actions, Tabler geometry and Pointer Events', async () => {
  const dock = await source('src/randapp/prototype-liquid-dock.js')
  for (const icon of ['plus', 'tool', 'calendar', 'package', 'sparkles']) assert.match(dock, new RegExp(`${icon}:`))
  assert.match(dock, /pointerdown/)
  assert.match(dock, /pointerup/)
  assert.match(dock, /pointercancel/)
  assert.match(dock, /data-testid=\\?"fab-new\\?"|\[data-testid="fab-new"\]/)
  assert.match(dock, /insert-issue/)
  assert.match(dock, /insert-intervention/)
  assert.match(dock, /nav-inventory/)
  assert.match(dock, /randai-toggle/)
  assert.doesNotMatch(dock, /Scarico da magazzino/)
})

test('dock structurally owns the real Shell bottom navigation instead of stacking a second capsule', async () => {
  const [dock, dockCss, finalCss] = await Promise.all([
    source('src/randapp/prototype-liquid-dock.js'),
    source('src/randapp/prototype-liquid-dock.css'),
    source('src/randapp/randapp-final-layout.css'),
  ])
  assert.match(dock, /data-dock-navslot/)
  assert.match(dock, /appendChild\(nav\)/)
  assert.match(dock, /restoreNav/)
  assert.match(dockCss, /\.rs-liquid-dock \.rs-bottomnav/)
  assert.match(finalCss, /\.rs-liquid-dock__surface/)
  assert.match(finalCss, /\.rs-liquid-dock__bridge/)
  assert.match(finalCss, /\.rs-liquid-dock__pull \{ display: none/)
  assert.match(finalCss, /data-slot='3'\]\.active/)
  assert.match(finalCss, /transform: none !important/)
  assert.doesNotMatch(finalCss, /RandAI •/)
})

test('final layout covers phone, tablet, desktop and Grande mode', async () => {
  const css = await source('src/randapp/randapp-final-layout.css')
  assert.match(css, /max-width: 520px/)
  assert.match(css, /min-width: 640px.*max-width: 959px/s)
  assert.match(css, /min-width: 960px/)
  assert.match(css, /min-width: 1500px/)
  assert.match(css, /data-ui-size='large'/)
  assert.match(css, /--rs-mobile-dock-clearance/)
  assert.match(css, /\.rs-workhome__stats/)
  assert.match(css, /\.rs-sidebar/)
  assert.match(css, /\.rs-sheet/)
})

test('Liquid Glass layer keeps accessibility and unsupported-browser fallbacks', async () => {
  const [vendor, dockCss, finalCss] = await Promise.all([
    source('src/randapp/vendor/liquid-glass-ui.css'),
    source('src/randapp/prototype-liquid-dock.css'),
    source('src/randapp/randapp-final-layout.css'),
  ])
  assert.match(vendor, /prefers-reduced-motion/)
  assert.match(vendor, /prefers-reduced-transparency/)
  assert.match(vendor, /forced-colors/)
  assert.match(vendor, /@supports not/)
  assert.match(dockCss, /prefers-reduced-motion/)
  assert.match(finalCss, /prefers-reduced-motion/)
  assert.match(finalCss, /forced-colors/)
})
