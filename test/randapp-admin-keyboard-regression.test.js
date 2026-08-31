import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/randapp/App.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/randapp/admin-keyboard-fix.css', import.meta.url), 'utf8')

test('admin keyboard fix is loaded and scoped to the Admin Gate', () => {
  assert.match(main, /import '\.\/randapp\/admin-keyboard-fix\.css'/)
  assert.match(app, /className="rs-auth rs-auth--admin"/)
  assert.match(app, /data-testid="admin-back"/)
  assert.match(app, /document\.activeElement/)
  assert.doesNotMatch(css, /:has\(/)
})

test('admin PIN gate compacts safely inside a mobile keyboard viewport', () => {
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /\.rs-auth--admin:focus-within/)
  assert.match(css, /height: 100dvh/)
  assert.match(css, /overflow-y: auto/)
  assert.match(css, /min-height: 48px/)
})
