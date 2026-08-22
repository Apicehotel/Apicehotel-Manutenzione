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
  assert.match(styles, /\.ops-main\.global-admin \{ width: 100%; padding: max\(54px, env\(safe-area-inset-top\)\) 14px 32px; overflow-x: hidden; \}/)
})

test('safe-area del pannello admin: .ops-main.global-admin vince sempre su .ops-main generico, indipendentemente dall\'ordine nel foglio di stile', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  // Bug reale: '.global-admin' da solo aveva la stessa specificità di '.ops-main'
  // (0,1,0) — la regola generica '.ops-main { padding: 0 14px 142px }' dichiarata
  // dopo vinceva in cascata e azzerava il padding-top della safe-area, facendo
  // sovrapporre 'Torna alla Home' alla status bar. Selettore composto
  // '.ops-main.global-admin' (specificità 0,2,0) risolve indipendentemente
  // dall'ordine delle regole nel file.
  assert.match(styles, /\.ops-main\.global-admin \{ padding-top: max\(56px, calc\(env\(safe-area-inset-top\) \+ 14px\)\) ?; ?\}/)
  assert.doesNotMatch(styles, /(?<!\.ops-main)\.global-admin \{/)
})

test('admin panel: nuovo pulsante Attiva per riportare online un utente disattivato, mancava del tutto', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const activate = async \(target\) => \{ try \{ await setUserActive\(target\.id, true\); await onReload\(\); setMessage\(`\$\{target\.name\} riattivato`\) \} catch \(error\) \{ setMessage\(error\?\.message \|\| 'Errore durante la riattivazione'\) \} \}/)
  assert.match(app, /\{target\.active\?<button className="delete-user" onClick=\{\(\)=>deactivate\(target\)\} disabled=\{target\.protected\}>Disattiva<\/button>:<button className="activate-user" onClick=\{\(\)=>activate\(target\)\}>Attiva<\/button>\}/)
  // Etichetta visibile per capire subito chi è disattivato, senza dover controllare ogni riga.
  assert.match(app, /\{!target\.active&&<small className="user-inactive-label">Disattivato<\/small>\}/)
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
