import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../src/randapp/chat/ChatGroups.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/randapp/chat/chat-viewport.css', import.meta.url), 'utf8')

test('RandChat measures the real visible area instead of relying on a fixed mobile offset', () => {
  assert.match(component, /window\.visualViewport/)
  assert.match(component, /querySelector\('\.rs-bottomnav'\)/)
  assert.match(component, /--rc-viewport-h/)
  assert.match(component, /window\.scrollTo\(\{ top: 0/)
  assert.match(component, /import '\.\/chat\.css'\s*\nimport '\.\/chat-viewport\.css'/)
})

test('RandChat locks page scrolling and leaves scrolling to message and thread areas', () => {
  assert.match(css, /body\.rs-randchat-active\s*\{[^}]*overflow:\s*hidden/is)
  assert.match(css, /\.rs-content\.rs-content--randchat\s*\{[^}]*padding-bottom:\s*0\s*!important/is)
  assert.match(css, /\.rc-module\s*\{[^}]*height:\s*var\(--rc-viewport-h/is)
  assert.match(css, /\.rc-module \.rc-messages,[\s\S]*?overflow-y:\s*auto/is)
  assert.match(css, /overscroll-behavior:\s*contain/i)
})
