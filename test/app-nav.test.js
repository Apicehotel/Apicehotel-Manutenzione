import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('AppNav: bottom nav mobile e sidebar desktop condividono lo stesso markup, max 5 voci fisse', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])

  // Voci fisse richieste: Home, Segnalazioni, (+ centrale), Planning, Altro.
  assert.match(app, /key: 'Home', label: 'Home'/)
  assert.match(app, /key: 'Segnalazioni', label: 'Segnalazioni'/)
  assert.match(app, /key: 'Planning', label: 'Planning'/)
  assert.match(app, /<span>Altro<\/span>/)
  // Interventi non è più una voce di navigazione primaria: resta raggiungibile dalla card Home e dal pannello Altro.
  assert.doesNotMatch(app, /key: 'Interventi'/)

  // Icona + testo su ogni voce.
  assert.match(app, /<Icon name=\{item\.icon\} \/><span>\{item\.label\}<\/span>/)

  // Un solo componente, stile diverso via CSS (breakpoint coerente col resto del foglio, non due app separate).
  assert.match(styles, /\.app-nav \{ position: fixed;/)
  assert.match(styles, /@media \(min-width: 701px\) \{/)

  // Safe area rispettata su iOS (bottom bar mobile).
  assert.match(styles, /\.app-nav \{[^}]*env\(safe-area-inset-bottom\)/)
})

test('index.html dichiara viewport-fit=cover per le safe area iOS', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(html, /viewport-fit=cover/)
})

test('la sezione attiva è indicata chiaramente e la bottom nav non copre il contenuto', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /className=\{\(item\.match \|\| \[item\.key\]\)\.includes\(tab\) \? 'active' : ''\}/)
  assert.match(app, /aria-current=\{\(item\.match \|\| \[item\.key\]\)\.includes\(tab\) \? 'page' : undefined\}/)
  assert.match(styles, /\.app-nav button\.active \{ color: #0e5c49; \}/)
  // ops-main lascia spazio per la nav fissa (non la copre).
  assert.match(styles, /\.ops-main \{ width: min\(1120px, 100%\); margin: 0 auto; padding: 26px 18px calc\(var\(--nav-h\)/)
})

test('Home dashboard: card mobile-first, azione rapida, funziona come nuova landing post-login', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /function HomeDashboard\(/)
  assert.match(app, /const \[tab, setTab\] = useState\('Home'\)/)
  assert.match(app, /tab === 'Home' \? <HomeDashboard/)
  assert.match(styles, /\.dash-cards \{ display: grid; grid-template-columns: 1fr;/)
  assert.match(styles, /@media \(min-width: 701px\) \{\n  \.dash-cards \{ grid-template-columns: repeat\(2/)
})

test('Housekeeping NON compare mai nella bottom nav primaria, solo nel pannello Altro (nessuna eccezione)', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /function AppNav\(\{ tab, onSelect, onAltro, isAltroActive, showPlanning, urgentBadge, primaryAction \}\) \{/)
  assert.doesNotMatch(app, /key: 'Housekeeping'/)
  assert.doesNotMatch(app, /showHousekeeping/)
  assert.match(app, /canViewHousekeeping\(user\) && <button onClick=\{\(\) => \{ setTab\('Housekeeping'\)/)
  assert.match(app, /isAltroActive=\{\['Housekeeping','Avvisi Urgenti','Interventi','Feedback ricevuti','Il mio profilo','Cambia PIN','Manuale','Feedback'\]\.includes\(tab\)\}/)
})

test('Interventi resta raggiungibile dal pannello Altro, nessuna funzione persa togliendolo dalla nav primaria', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /canViewPlanned\(user\) && <button onClick=\{\(\) => \{ setTab\('Interventi'\)/)
})

test('un solo punto di accesso al pannello Altro: niente più hamburger duplicato in header', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /menu-trigger/)
  assert.doesNotMatch(app, /aria-label="Apri menu"/)
  assert.match(app, /onAltro=\{\(\) => setMenuOpen\(true\)\}/)
})

test('il + centrale è contestuale su Planning Lavori/Sale (Nuovo lavoro/Nuova prenotazione), fisso su Nuova segnalazione altrove; Interventi mantiene il suo FAB dedicato', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /primaryAction=\{primaryAction\}/)
  assert.match(app, /const primaryAction = tab === 'Planning Lavori' && canViewPlanningMenu\(user\) \? \{ label: 'Nuovo lavoro', onClick: \(\) => setPlannedFormOpen\(true\) \} : tab === 'Planning Sale' && hotel\.id === 'hotelgio' && \['admin', 'Responsabile', 'Direttore Centro Congressi'\]\.includes\(user\.role\) \? \{ label: 'Nuova prenotazione', onClick: \(\) => setSaleComposeRequest/)
  assert.match(app, /\{primaryAction && <button type="button" className="app-nav-fab"/)
  // Interventi mantiene il proprio FAB dedicato (non ha una controparte nel + centrale).
  assert.match(app, /tab === 'Interventi' && canCreatePlanned\(user\) && <button className="fab-new-issue planned-fab"/)
  // Planning Lavori/Sale NON hanno più un FAB scoped duplicato: l'azione è ora nel + centrale.
  assert.doesNotMatch(app, /tab === 'Planning Lavori' && canViewPlanningMenu\(user\) && <button className="fab-new-issue planned-fab"/)
  // L'avviso urgente ora è un FAB scoped alla pagina Avvisi Urgenti (stesso pattern di
  // Interventi/Planning Lavori), non più un secondo pulsante rosso sempre visibile in
  // parallelo al + verde centrale.
  assert.match(app, /tab === 'Avvisi Urgenti' && canSendUrgent\(user\) && <button className="fab-new-issue planned-fab urgent-fab-scoped"/)
  assert.doesNotMatch(app, /\{canSendUrgent\(user\) && <button className="urgent-fab"/)
  assert.match(styles, /\.app-nav button\.app-nav-fab \{ flex: 0 0 auto;/)
})
