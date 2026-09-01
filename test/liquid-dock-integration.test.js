import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('LiquidGlass material remains loaded before the final visual layer', async () => {
  const main = await source('src/main.jsx')
  const vendorIndex = main.indexOf("./randapp/vendor/liquid-glass-ui.css")
  const finalIndex = main.indexOf("./randapp/randapp-final-layout.css")
  assert.ok(vendorIndex >= 0, 'LiquidGlass UI vendor stylesheet must be loaded')
  assert.ok(finalIndex > vendorIndex, 'final RandApp layout must load after the LiquidGlass material')
  assert.doesNotMatch(main, /installLiquidDockPrototype/)
  assert.doesNotMatch(main, /prototype-liquid-dock\.css/)
})

test('mobile command dock is a native React child of Shell with real handlers', async () => {
  const [shell, dock] = await Promise.all([
    source('src/randapp/Shell.jsx'),
    source('src/randapp/MobileCommandDock.jsx'),
  ])
  assert.match(shell, /<MobileCommandDock/)
  assert.match(shell, /onQuickIssue=/)
  assert.match(shell, /onQuickIntervention=/)
  assert.match(shell, /onQuickPlanning=/)
  assert.match(shell, /onQuickInventory=/)
  assert.match(shell, /randai-toggle/)
  assert.match(dock, /onPointerDown/)
  assert.match(dock, /onPointerUp/)
  assert.match(dock, /Nuova segnalazione/)
  assert.match(dock, /Nuovo intervento/)
  assert.match(dock, /Magazzino/)
  assert.doesNotMatch(dock, /Scarico da magazzino/)
})

test('dock keeps one surface, five real nav slots and no fake Home/RandAI coupling', async () => {
  const [dock, css] = await Promise.all([
    source('src/randapp/MobileCommandDock.jsx'),
    source('src/randapp/mobile-command-dock.css'),
  ])
  assert.match(dock, /rs-mobile-dock/)
  assert.match(dock, /rs-bottomnav--integrated/)
  assert.match(dock, /data-count="5"/)
  assert.match(css, /\.rs-mobile-dock::before/)
  assert.match(css, /data-slot='3'/)
  assert.match(css, /transform:\s*none/)
  assert.doesNotMatch(css, /RandAI •/)
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

test('Liquid Glass and native dock keep accessibility fallbacks', async () => {
  const [vendor, dockCss, finalCss] = await Promise.all([
    source('src/randapp/vendor/liquid-glass-ui.css'),
    source('src/randapp/mobile-command-dock.css'),
    source('src/randapp/randapp-final-layout.css'),
  ])
  assert.match(vendor, /prefers-reduced-motion/)
  assert.match(vendor, /prefers-reduced-transparency/)
  assert.match(vendor, /forced-colors/)
  assert.match(vendor, /@supports not/)
  assert.match(dockCss, /prefers-reduced-motion/)
  assert.match(dockCss, /forced-colors/)
  assert.match(finalCss, /prefers-reduced-motion/)
  assert.match(finalCss, /forced-colors/)
})
