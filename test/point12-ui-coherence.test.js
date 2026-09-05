import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const main = read('src/main.jsx')
const foundation = read('src/randapp/randui/foundation.css')
const css = read('src/randapp/ui-coherence.css')
const settings = read('src/randapp/Settings.jsx')
const shell = read('src/randapp/shell.css')
const ui = read('src/randapp/ui.jsx')

test('point 12 coherence layer is owned by the final foundation after feature-specific styles', () => {
  const finalFoundation = main.indexOf("import './randapp/randui/foundation.css'")
  assert.ok(finalFoundation > -1, 'RandUI foundation must be imported')
  assert.match(foundation, /@import '\.\.\/ui-coherence\.css'/)
  for (const feature of [
    "./randapp/planning-sale-v2.css",
    "./housekeeping-dark-theme.css",
    "./randapp/new-issue-form-v2.css",
  ]) assert.ok(finalFoundation > main.indexOf(`import '${feature}'`), `${feature} must load before final foundation`)
})

test('point 12 preserves one shared primitive set', () => {
  for (const primitive of ['Button', 'IconButton', 'Card', 'Field', 'TextInput', 'Badge', 'Segmented', 'Spinner', 'EmptyState', 'Sheet', 'Modal', 'ConfirmDialog']) {
    assert.match(ui, new RegExp(`export function ${primitive}\\b`), `${primitive} must remain centralized in ui.jsx`)
  }
  assert.match(shell, /Single source of truth/)
})

test('point 12 normalizes touch targets, focus, fields and responsive actions', () => {
  assert.match(css, /--rs-control-h:/)
  assert.match(css, /button:focus-visible/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /\.rs-input\s*\{\s*min-height:/)
  assert.match(css, /\.rs-textarea\s*\{[^}]*resize:\s*vertical/s)
  assert.match(css, /\.rs-form-actions/)
  assert.match(css, /@media \(max-width: 360px\)/)
})

test('point 12 handles accessibility preferences and mobile viewport constraints', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /prefers-contrast:\s*more/)
  assert.match(css, /safe-area-inset-left/)
  assert.match(css, /safe-area-inset-right/)
  assert.match(css, /svh/)
  assert.match(css, /overscroll-behavior:\s*contain/)
})

test('settings navigation exposes stable tab semantics', () => {
  assert.match(settings, /aria-label="Sezioni impostazioni"/)
  assert.match(settings, /role="tab"/)
  assert.match(settings, /aria-selected=/)
  assert.match(settings, /aria-controls="settings-panel"/)
  assert.match(settings, /type="button"/)
})
