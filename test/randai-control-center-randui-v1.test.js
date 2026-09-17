import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const bridge = read('src/randai/control/randui-control-bridge.css')
const responsive = read('src/randai/control/randai-responsive.css')
const shell = read('src/randapp/shell.css')

test('RandAI Control Center compatibility variables are owned by RandUI tokens', () => {
  assert.match(responsive, /^@import ['"]\.\/randui-control-bridge\.css['"];?/)
  const aliases = {
    '--rc-bg': '--rs-bg',
    '--rc-panel': '--rs-surface',
    '--rc-panel2': '--rs-surface-2',
    '--rc-line': '--rs-line',
    '--rc-text': '--rs-text',
    '--rc-soft': '--rs-text-2',
    '--rc-purple': '--rs-blue',
    '--rc-good': '--rs-ok',
    '--rc-warn': '--rs-warn',
    '--rc-bad': '--rs-danger',
  }
  for (const [legacy, canonical] of Object.entries(aliases)) {
    assert.match(bridge, new RegExp(`${legacy.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}:\\s*var\\(${canonical.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\)`))
  }
})

test('Control Center uses the canonical RandUI theme contract and keeps compatibility bridge scoped', () => {
  for (const token of ['--rs-bg:', '--rs-surface:', '--rs-text:', '--rs-line:', '--rs-ok:', '--rs-warn:', '--rs-danger:']) {
    assert.match(shell, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')))
  }
  assert.match(bridge, /New Control Center styles must use `--rs-\*` directly/)
  assert.match(bridge, /html\[data-theme\] \.rc-shell\.rc-shell/)
  assert.doesNotMatch(bridge, /:root\s*\{/)
})

test('Control Center inherits accessibility behavior instead of defining another UI system', () => {
  assert.match(bridge, /font-family:\s*inherit/)
  assert.match(bridge, /min-height:\s*calc\(44px \* var\(--rs-scale, 1\)\)/)
  assert.match(bridge, /:focus-visible/)
  assert.match(bridge, /prefers-reduced-motion:\s*reduce/)
  assert.match(bridge, /forced-colors:\s*active/)
})
