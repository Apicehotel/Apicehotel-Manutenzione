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
  assert.match(styles, /html\[data-ui-size="small"\] body \{ width:111\.112%; zoom:\.9; \}/)
  assert.match(styles, /html\[data-ui-size="large"\] body \{ width:89\.286%; zoom:1\.12; \}/)
})
