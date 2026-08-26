import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [shellCss, hkCss, insertCss, home, shell, main] = await Promise.all([
  readFile(new URL('../src/randapp/shell.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/randapp/housekeeping-alert.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/randapp/insert-form.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/randapp/Home.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
])

test('all RandApp pages reserve bottom space for nav, safe-area and global FAB', () => {
  assert.match(shellCss, /--rs-content-bottom-clearance:[^;]*var\(--rs-nav-h\)[^;]*var\(--rs-safe-bottom\)[^;]*var\(--rs-fab-h\)/)
  assert.match(shellCss, /\.rs-content\s*\{[\s\S]*?var\(--rs-content-bottom-clearance\)/)
})

test('Housekeeping completion alert participates in page flow instead of covering the screen', () => {
  assert.doesNotMatch(hkCss, /\.rs-hk-alert\{[^}]*position:fixed/)
  assert.match(hkCss, /\.rs-hk-alert\{[^}]*position:relative/)
  assert.match(shell, /<HousekeepingCompletionAlerts \/>/)
  assert.doesNotMatch(main, /HousekeepingCompletionAlerts/)
})

test('issue photo preview does not use absolute negative overlap compensation', () => {
  const match = insertCss.match(/\.rs-form:has\(\[data-testid="issue-title-input"\]\)[^\n]*\.rs-photo-preview\{([^}]*)\}/)
  assert.ok(match, 'photo preview rule missing')
  assert.doesNotMatch(match[1], /position:absolute|margin(?:-top)?:\s*-/)
  assert.match(match[1], /position:static/)
})

test('mobile Home widget grid stays inside its container without negative gutter expansion', () => {
  assert.doesNotMatch(home, /rs-widget-grid-shell\{margin-inline:-/)
  assert.doesNotMatch(home, /rs-widget-grid-shell\{[^}]*width:calc\(100%\s*\+/)
})
