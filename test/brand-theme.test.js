import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('tema struttura: Giò verde, Choco bordeaux, Brigantino blu e CSS caricato per ultimo', async () => {
  const [config, app, main, theme] = await Promise.all([
    readFile(new URL('../src/config.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/brand-theme.css', import.meta.url), 'utf8'),
  ])

  assert.match(config, /id: 'hotelgio'.*tone: 'green'/)
  assert.match(config, /id: 'chocohotel'.*tone: 'choco'/)
  assert.match(config, /id: 'brigantino'.*tone: 'blue'/)
  assert.match(app, /className=\{`operations theme-\$\{hotel\.tone\}`\}/)
  assert.match(theme, /\.operations\.theme-green\{--brand:#285f28\}/)
  assert.match(theme, /\.operations\.theme-choco\{--brand:#7a1520\}/)
  assert.match(theme, /\.operations\.theme-blue\{--brand:#123c72\}/)
  assert.match(theme, /\.operations \.app-nav button\.active,[\s\S]*color:var\(--brand\)/)
  assert.match(theme, /\.operations \.dash-quick button\{[\s\S]*color:var\(--brand\)/)

  const styles = main.indexOf("import './styles.css'")
  const mockup = main.indexOf("import './mockup-ui.css'")
  const header = main.indexOf("import './header-scale.css'")
  const brand = main.indexOf("import './brand-theme.css'")
  assert.ok(styles >= 0 && mockup > styles && header > mockup && brand > header)
})
