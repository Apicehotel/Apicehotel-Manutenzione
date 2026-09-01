import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('App Shell imports the RandApp visual system as its final visual layer', async () => {
  const shell = await source('src/randapp/app-shell-foundation.css')
  assert.match(shell, /@import '\.\/randapp-visual-system\.css';/)
})

test('visual system exposes semantic tokens instead of feature-specific colors', async () => {
  const css = await source('src/randapp/randapp-visual-system.css')
  for (const token of ['--rs-accent:', '--rs-success:', '--rs-warning:', '--rs-error:', '--rs-control-h:', '--rs-radius-card:']) {
    assert.ok(css.includes(token), `missing ${token}`)
  }
  assert.match(css, /html\[data-theme='light'\]/)
  assert.match(css, /html\[data-theme='dark'\]/)
})

test('glass is progressive and accessibility-safe', async () => {
  const css = await source('src/randapp/randapp-visual-system.css')
  assert.match(css, /@supports \(\(backdrop-filter: blur\(1px\)\)/)
  assert.match(css, /prefers-reduced-transparency: reduce/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /forced-colors: active/)
  assert.match(css, /\.rs-header, \.rs-bottomnav, \.rs-sheet, \.rs-drawer/)
})

test('operational cards remain solid while shared chrome can use glass', async () => {
  const css = await source('src/randapp/randapp-visual-system.css')
  assert.match(css, /\.rs-card \{[\s\S]*background: var\(--rs-surface\)/)
  assert.doesNotMatch(css, /\.rs-card[^}]*backdrop-filter/)
  assert.match(css, /--rs-touch-min: 44px/)
  assert.match(css, /:focus-visible/)
})
