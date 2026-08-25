import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('tema struttura: Giò verde, Choco bordeaux, Brigantino blu e RandApp CSS in ordine stabile', async () => {
  const [config, app, main, theme] = await Promise.all([
    readFile(new URL('../src/config.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/brand-theme.css', import.meta.url), 'utf8'),
  ])

  assert.match(config, /id: 'hotelgio'.*tone: 'green'/)
  assert.match(config, /id: 'chocohotel'.*tone: 'choco'/)
  assert.match(config, /id: 'brigantino'.*tone: 'blue'/)
  assert.match(app, /operations theme-\$\{hotel\.tone\}/)

  assert.match(theme, /\.operations\.theme-green\{--brand:#285f28\}/)
  assert.match(theme, /\.operations\.theme-choco\{--brand:#7a1520\}/)
  assert.match(theme, /\.operations\.theme-blue\{--brand:#123c72\}/)
  assert.match(theme, /\.operations \.app-nav button\.active[\s\S]*color:var\(--brand\)/)
  assert.match(theme, /\.operations \.dash-quick button[\s\S]*color:var\(--brand\)/)

  const shell = main.indexOf("import './randapp/shell.css'")
  const migrated = main.indexOf("import './randapp/migrated.css'")
  const insertForm = main.indexOf("import './randapp/insert-form.css'")
  assert.ok(shell >= 0 && migrated > shell && insertForm > migrated)
  assert.doesNotMatch(main, /^import '\.\/mockup-ui\.css'$/m)
  assert.doesNotMatch(main, /^import '\.\/header-scale\.css'$/m)
  assert.doesNotMatch(main, /^import '\.\/brand-theme\.css'$/m)
})
