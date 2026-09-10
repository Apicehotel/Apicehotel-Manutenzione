import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/randapp/ios-login-keyboard.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('mobile login stays stable when iOS keyboard shrinks the visual viewport', () => {
  assert.equal(css.includes('height: 100dvh'), true)
  assert.equal(css.includes('min-height: 100svh'), true)
  assert.equal(css.includes('overflow-y: auto'), true)
  assert.equal(css.includes('flex-shrink: 0'), true)
})

test('login inputs keep Safari-safe font size and focus scroll room', () => {
  assert.equal(css.includes('font-size: max(16px, 1rem)'), true)
  assert.equal(css.includes(':focus-within'), true)
  assert.equal(css.includes('scroll-padding-bottom'), true)
})

test('iOS keyboard fix stylesheet is loaded after login reference styles', () => {
  const reference = main.indexOf("import './randapp/login-reference.css'")
  const keyboard = main.indexOf("import './randapp/ios-login-keyboard.css'")
  assert.ok(reference >= 0)
  assert.ok(keyboard > reference)
})
