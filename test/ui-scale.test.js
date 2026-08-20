import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('la dimensione globale dell interfaccia e selezionabile e persistente', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /UI_SIZE_STORAGE_KEY = 'apicehotel\.ui-size\.v1'/)
  assert.match(app, /Dimensione interfaccia/)
  assert.match(app, /\['small','normal','large'\]/)
  assert.match(app, /document\.documentElement\.dataset\.uiSize = uiSize/)
  assert.match(app, /const loadUiSize = \(\) =>/)
  assert.match(app, /catch \{ return 'normal' \}/)

  // Il dimensionamento usa CSS custom properties, non lo zoom CSS (richiesto esplicitamente).
  assert.doesNotMatch(styles, /zoom:/)
  assert.match(styles, /--font-base: 16px;/)
  assert.match(styles, /html\[data-ui-size="small"\] \{/)
  assert.match(styles, /--font-base: 14px;/)
  assert.match(styles, /html\[data-ui-size="large"\] \{/)
  assert.match(styles, /--font-base: 20px;/)
  assert.match(styles, /--control-h: 54px;/)
  assert.match(styles, /body \{ margin: 0; min-width: 320px; min-height: 100vh; overflow-x:hidden; font-size: var\(--font-base\); \}/)
  assert.match(styles, /\.issue,\.urgent-card,\.planned-card,\.hk-room \{ content-visibility:auto;/)
})
