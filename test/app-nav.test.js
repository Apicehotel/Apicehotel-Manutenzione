import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('AppNav: bottom nav mobile e sidebar desktop condividono lo stesso markup, max 5 voci fisse', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])

  // Voci fisse richieste: Home, Segnalazioni, Interventi (se abilitato), Planning, Altro.
  assert.match(app, /key: 'Home', label: 'Home'/)
  assert.match(app, /key: 'Segnalazioni', label: 'Segnalazioni'/)
  assert.match(app, /key: 'Interventi', label: 'Interventi'/)
  assert.match(app, /key: 'Planning', label: 'Planning'/)
  assert.match(app, /<span>Altro<\/span>/)

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
  assert.match(app, /function AppNav\(\{ tab, onSelect, onAltro, isAltroActive, showPlanning, showInterventi, interventiBadge, urgentBadge \}\) \{/)
  assert.doesNotMatch(app, /key: 'Housekeeping'/)
  assert.doesNotMatch(app, /showHousekeeping/)
  assert.match(app, /canViewHousekeeping\(user\) && <button onClick=\{\(\) => \{ setTab\('Housekeeping'\)/)
  assert.match(app, /isAltroActive=\{\['Housekeeping','Avvisi Urgenti','Feedback ricevuti','Il mio profilo','Cambia PIN','Manuale','Feedback'\]\.includes\(tab\)\}/)
})

test('Interventi è una vera voce della bottom nav (React), non più iniettata via script esterno che manipolava il DOM in parallelo a React', async () => {
  const [app, main] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(app, /\.\.\.\(showInterventi \? \[\{ key: 'Interventi', label: 'Interventi', icon: 'tool', badge: interventiBadge \}\] : \[\]\)/)
  assert.match(app, /showInterventi=\{canViewPlanned\(user\)\}/)
  assert.doesNotMatch(main, /mobile-nav-enhancer/)
  await assert.rejects(readFile(new URL('../src/mobile-nav-enhancer.js', import.meta.url)))
})

test('un solo punto di accesso al pannello Altro: niente più hamburger duplicato in header', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /menu-trigger/)
  assert.doesNotMatch(app, /aria-label="Apri menu"/)
  assert.match(app, /onAltro=\{\(\) => setMenuOpen\(true\)\}/)
})

test('menu "Nuovo" a mezza luna in Home: sostituisce il vecchio + contestuale nella barra di navigazione, con le 4 scelte filtrate per permesso', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /function AppNav\(\{ tab, onSelect, onAltro, isAltroActive, showPlanning, showInterventi, interventiBadge, urgentBadge \}\) \{/)
  assert.doesNotMatch(app, /primaryAction/)
  assert.doesNotMatch(app, /app-nav-fab/)
  assert.match(app, /function HomeFab\(\{ items \}\)/)
  assert.match(app, /const homeFabItems = \[/)
  assert.match(app, /permissions\.includes\('create'\) && \{ key: 'segnalazione', label: 'Nuova segnalazione'/)
  assert.match(app, /canCreatePlanned\(user\) && \{ key: 'intervento', label: 'Nuovo intervento'/)
  assert.match(app, /canViewPlanningMenu\(user\) && \{ key: 'lavoro', label: 'Nuovo lavoro'/)
  assert.match(app, /hotel\.id === 'hotelgio' && \['admin', 'Responsabile', 'Direttore Centro Congressi'\]\.includes\(user\.role\)\) && \{ key: 'sala', label: 'Nuova prenotazione'/)
  assert.match(app, /\{tab === 'Home' && <HomeFab items=\{homeFabItems\} \/>\}/)
  // Interventi e Avvisi Urgenti mantengono il proprio FAB dedicato, invariato.
  assert.match(app, /tab === 'Interventi' && canCreatePlanned\(user\) && <button className="fab-new-issue planned-fab"/)
  assert.match(app, /tab === 'Avvisi Urgenti' && canSendUrgent\(user\) && <button className="fab-new-issue planned-fab urgent-fab-scoped"/)
  assert.match(styles, /\.home-fab-main \{/)
  assert.match(styles, /\.home-fab-item \{/)
})

