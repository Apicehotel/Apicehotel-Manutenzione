import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const navigation = fs.readFileSync(new URL('../src/randapp/shell-navigation.js', import.meta.url), 'utf8')
const shell = fs.readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const nav = fs.readFileSync(new URL('../src/randapp/nav.js', import.meta.url), 'utf8')
const hub = fs.readFileSync(new URL('../src/randapp/operations/OperationsHub.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/randapp/telegram-navigation.css', import.meta.url), 'utf8')
const catalog = fs.readFileSync(new URL('../src/randapp/randui/page-catalog.js', import.meta.url), 'utf8')

test('mobile primary navigation keeps Home central and RandAI far right', () => {
  assert.match(navigation, /home:\s*3/)
  assert.match(navigation, /randai:\s*5/)
  assert.match(navigation, /id:\s*'home'.*label:\s*'Home'/s)
  assert.match(navigation, /id:\s*'randai'.*action:\s*'randai'/s)
  assert.doesNotMatch(navigation, /label:\s*'Altro'/)
  assert.match(css, /data-slot='3'/)
  assert.match(css, /data-slot='5'/)
})

test('Operatività is a permission-aware hub without merging child workflows', () => {
  assert.match(nav, /id:\s*'operations'/)
  assert.match(nav, /canSeeOperations/)
  assert.match(hub, /operations-open-issues/)
  assert.match(hub, /operations-open-interventions/)
  assert.match(hub, /onOpen\('issues'\)/)
  assert.match(hub, /onOpen\('interventions'\)/)
  assert.match(shell, /view === 'operations'/)
  assert.match(shell, /canIssues=\{viewAllowed\('issues'\)\}/)
  assert.match(shell, /canInterventions=\{viewAllowed\('interventions'\)\}/)
  assert.match(catalog, /operations: page\(/)
})

test('complete menu is profile-driven and grouped in accessible accordions', () => {
  assert.match(shell, /data-testid="header-profile-menu"/)
  assert.match(shell, /setDrawer\(true\)/)
  assert.match(shell, /rs-drawer__group-toggle/)
  assert.match(shell, /aria-expanded=\{open\}/)
  assert.match(shell, /aria-controls=\{`drawer-group-/)
  assert.match(shell, /buildNav\(user, hotel, navigationConfig, null\)/)
  assert.doesNotMatch(shell, /item\.id === 'menu'/)
})

test('RandAI remains a global assistant action rather than a duplicate page', () => {
  assert.match(shell, /item\.action === 'randai'/)
  assert.match(shell, /new CustomEvent\('randai-toggle'\)/)
  assert.match(css, /rs-header__randai--desktop/)
})

test('Telegram visual layer is runtime-owned while navigation logic stays side-effect free', () => {
  assert.match(main, /import ['"]\.\/randapp\/telegram-navigation\.css['"]/)
  assert.doesNotMatch(navigation, /telegram-navigation\.css/)
  assert.match(css, /var\(--rs-/)
  assert.match(css, /min-height:\s*54px/)
  assert.match(css, /focus-visible/)
  assert.match(css, /@media \(max-width: 360px\)/)
})
