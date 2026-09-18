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


test('mobile head bar stays fixed and content clears the measured live header height', () => {
  assert.match(shellCss, /\.rs-header\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*0;[\s\S]*?left:\s*0;[\s\S]*?right:\s*0;/)
  assert.match(shellCss, /--rs-headbar-live-h:\s*calc\(var\(--rs-mobile-headbar-h\) \+ var\(--rs-safe-top\)\)/)
  assert.match(shellCss, /min-height:\s*var\(--rs-headbar-live-h\)/)
  assert.match(shellCss, /@media \(max-width: 1023px\)[\s\S]*?\.rs-content\s*\{[\s\S]*?padding-top:\s*calc\(var\(--rs-headbar-live-h\) \+ 20px\)/)
})


test('shell measures the real header height instead of relying only on a CSS estimate', async () => {
  const shell = await readFile(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
  assert.match(shell, /const headerRef = useRef\(null\)/)
  assert.match(shell, /new ResizeObserver\(syncHeaderHeight\)/)
  assert.match(shell, /getBoundingClientRect\(\)\.height/)
  assert.match(shell, /--rs-headbar-live-h/)
  assert.match(shell, /<header ref=\{headerRef\} className="rs-header rs-header--operational">/)
})
