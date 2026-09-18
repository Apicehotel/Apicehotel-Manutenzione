import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('RandUI theme engine owns one centralized semantic token contract', () => {
  const tokens = read('../src/randapp/randui/theme-tokens.css')
  for (const token of [
    '--rand-canvas',
    '--rand-surface-1',
    '--rand-text-primary',
    '--rand-border',
    '--rand-accent',
    '--rand-success',
    '--rand-warning',
    '--rand-danger',
    '--rand-info',
    '--rand-inactive',
    '--rand-radius-card',
    '--rand-shadow-surface',
    '--rand-font-sans',
  ]) {
    assert.ok(tokens.includes(token), `${token} missing from theme engine`)
  }
})

test('light and dark themes are explicit and dark uses layered graphite surfaces', () => {
  const tokens = read('../src/randapp/randui/theme-tokens.css')
  assert.match(tokens, /html\[data-theme='light'\]/)
  assert.match(tokens, /html\[data-theme='dark'\]/)
  assert.match(tokens, /--rand-canvas:\s*#111212/)
  assert.match(tokens, /--rand-surface-1:\s*#181a19/)
  assert.match(tokens, /--rand-surface-2:\s*#202221/)
  assert.doesNotMatch(tokens, /--rand-canvas:\s*#000(?:000)?\b/i)
})

test('legacy rs variables bridge to RandUI tokens instead of duplicating theme ownership', () => {
  const tokens = read('../src/randapp/randui/theme-tokens.css')
  const aliases = [
    ['--rs-bg', '--rand-canvas'],
    ['--rs-surface', '--rand-surface-1'],
    ['--rs-text', '--rand-text-primary'],
    ['--rs-line', '--rand-border'],
    ['--rs-cyan', '--rand-accent'],
    ['--rs-ok', '--rand-success'],
    ['--rs-warn', '--rand-warning'],
    ['--rs-danger', '--rand-danger'],
  ]
  for (const [legacy, canonical] of aliases) {
    assert.ok(tokens.includes(`${legacy}: var(${canonical})`), `${legacy} does not bridge to ${canonical}`)
  }
})

test('foundation loads tokens before visual and completion layers', () => {
  const foundation = read('../src/randapp/randui/foundation.css')
  const tokenImport = foundation.indexOf("@import './theme-tokens.css';")
  const visualImport = foundation.indexOf("@import './visual-language.css';")
  const completionImport = foundation.indexOf("@import './completion-v2.css';")
  assert.ok(tokenImport >= 0, 'theme token import missing')
  assert.ok(visualImport > tokenImport, 'visual language must load after tokens')
  assert.ok(completionImport > visualImport, 'completion layer must remain last')
  assert.match(foundation, /--rand-radius-sm:\s*var\(--rand-radius-control\)/)
  assert.match(foundation, /--rand-radius-md:\s*var\(--rand-radius-surface\)/)
  assert.match(foundation, /--rand-radius-lg:\s*var\(--rand-radius-card\)/)
})

test('semantic helpers use meaning-based tones and system typography', () => {
  const tokens = read('../src/randapp/randui/theme-tokens.css')
  for (const tone of ['info', 'success', 'warning', 'danger', 'inactive']) {
    assert.ok(tokens.includes(`.rs-randui-tone--${tone}`), `${tone} semantic helper missing`)
  }
  assert.match(tokens, /-apple-system/)
  assert.match(tokens, /BlinkMacSystemFont/)
  assert.match(tokens, /Segoe UI/)
})

test('theme engine is original RandUI code and carries no runtime UI dependency', () => {
  const tokens = read('../src/randapp/randui/theme-tokens.css')
  assert.doesNotMatch(tokens, /@mui|antd|chakra|bootstrap|tailwind|styled-components/i)
  assert.doesNotMatch(tokens, /@import\s+url/i)
  assert.match(tokens, /no third-party theme code is copied/i)
})
