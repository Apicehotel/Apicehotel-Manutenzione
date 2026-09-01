import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('executable dock loads the vendored LiquidGlass material before its overrides', async () => {
  const main = await source('src/main.jsx')
  const vendorIndex = main.indexOf("./randapp/vendor/liquid-glass-ui.css")
  const dockIndex = main.indexOf("./randapp/prototype-liquid-dock.css")
  assert.ok(vendorIndex >= 0, 'LiquidGlass UI vendor stylesheet must be loaded')
  assert.ok(dockIndex > vendorIndex, 'RandApp dock overrides must load after LiquidGlass UI')
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
  const [dock, dockCss] = await Promise.all([
    source('src/randapp/prototype-liquid-dock.js'),
    source('src/randapp/prototype-liquid-dock.css'),
  ])
  assert.match(dock, /data-dock-navslot/)
  assert.match(dock, /appendChild\(nav\)/)
  assert.match(dock, /restoreNav/)
  assert.match(dockCss, /\.rs-liquid-dock \.rs-bottomnav/)
  assert.match(dockCss, /\.rs-liquid-dock__surface/)
  assert.match(dockCss, /\.rs-liquid-dock__bridge/)
  assert.doesNotMatch(dockCss, /content:\s*['"]RandAI •['"]/)
})

test('Liquid Glass layer keeps accessibility and unsupported-browser fallbacks', async () => {
  const [vendor, dockCss] = await Promise.all([
    source('src/randapp/vendor/liquid-glass-ui.css'),
    source('src/randapp/prototype-liquid-dock.css'),
  ])
  assert.match(vendor, /prefers-reduced-motion/)
  assert.match(vendor, /prefers-reduced-transparency/)
  assert.match(vendor, /forced-colors/)
  assert.match(vendor, /@supports not/)
  assert.match(dockCss, /prefers-reduced-motion/)
  assert.match(dockCss, /forced-colors/)
  assert.match(dockCss, /data-slot='3'/)
})
