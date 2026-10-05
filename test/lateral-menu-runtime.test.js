import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const shellCss = readFileSync(new URL('../src/randapp/shell.css', import.meta.url), 'utf8')
const mobileCss = readFileSync(new URL('../src/randapp/header-mobile.css', import.meta.url), 'utf8')
const telegramCss = readFileSync(new URL('../src/randapp/telegram-navigation.css', import.meta.url), 'utf8')

test('mobile lateral menu styles are loaded by the runtime entry', () => {
  assert.match(main, /import '\.\/randapp\/header-mobile\.css'/)
  assert.match(mobileCss, /\.rs-header \.rs-profile-trigger/)
  assert.match(mobileCss, /Profile is the menu trigger/)
})

test('profile and Focus Mode controls both open the same drawer state', () => {
  assert.match(shell, /className="rnx-profile"[^>]*onClick=\{\(\) => setDrawer\(true\)\}[^>]*data-testid="header-profile-menu"/)
  assert.match(shell, /data-testid="operational-menu-trigger"/)
  assert.match(shell, /onClick=\{\(\) => setDrawer\(true\)\}/)
  assert.match(shell, /\{drawer && \(/)
  assert.match(shell, /data-testid="drawer"/)
})

test('drawer overlay owns the full viewport and stays above operational content', () => {
  assert.match(shellCss, /\.rs-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*display:\s*flex[^}]*height:\s*100dvh/s)
  assert.match(telegramCss, /\.rs-overlay--drawer\s*\{[^}]*z-index:\s*100/s)
  assert.match(telegramCss, /\.rs-drawer--telegram\s*\{[^}]*z-index:\s*101/s)
})
