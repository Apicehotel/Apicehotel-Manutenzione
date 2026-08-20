import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('il pannello admin diventa una lista di schede su smartphone', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])

  assert.match(app, /data-label="Ruolo"/)
  assert.match(app, /data-label="Reparto"/)
  assert.match(app, /data-label=\{hotel\.short\}/)
  assert.match(styles, /\.admin-panel table,\.admin-panel tbody \{ display: block; min-width: 0; \}/)
  assert.match(styles, /\.admin-panel thead \{ display: none; \}/)
  assert.match(styles, /\.admin-panel tr \{ display: grid; grid-template-columns: 1fr 1fr 1fr;/)
  assert.match(styles, /\.global-admin \{ width: 100%; padding: max\(22px, env\(safe-area-inset-top\)\) 14px 32px; overflow-x: hidden; \}/)
})

test('Ruoli e permessi è un pannello a scomparsa, chiuso di default', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /const \[rolesOpen, setRolesOpen\] = useState\(false\)/)
  assert.match(app, /<button type="button" className=\{`permission-matrix-toggle \$\{rolesOpen \? 'active' : ''\}`\} onClick=\{\(\) => setRolesOpen\(!rolesOpen\)\} aria-expanded=\{rolesOpen\}>/)
  assert.match(app, /\{rolesOpen && <>/)
  assert.match(styles, /\.permission-matrix-toggle \{ display: flex;/)
})
