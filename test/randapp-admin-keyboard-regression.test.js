import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/randapp/admin-keyboard-fix.css', import.meta.url), 'utf8')

test('admin keyboard fix is loaded by the app entrypoint', () => {
  assert.match(main, /import '\.\/randapp\/admin-keyboard-fix\.css'/)
})

test('admin PIN gate compacts safely inside a mobile keyboard viewport', () => {
  assert.match(css, /@media \(max-width: 767px\)/)
  assert.match(css, /admin-gate-submit/)
  assert.match(css, /:focus-within/)
  assert.match(css, /height: 100dvh/)
  assert.match(css, /overflow-y: auto/)
  assert.match(css, /min-height: 48px/)
})
