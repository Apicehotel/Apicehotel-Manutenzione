import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('AppNav: bottom nav mobile e sidebar desktop condividono lo stesso markup, max 5 voci fisse', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])

  // Le 5 voci fisse richieste: Home, Segnalazioni, Interventi, Planning, Altro.
  assert.match(app, /key: 'Home', label: 'Home'/)
  assert.match(app, /key: 'Segnalazioni', label: 'Segnalazioni'/)
  assert.match(app, /key: 'Interventi', label: 'Interventi'/)
  assert.match(app, /key: 'Planning Lavori', label: 'Planning'/)
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
  assert.match(app, /className=\{tab === item\.key \? 'active' : ''\}/)
  assert.match(app, /aria-current=\{tab === item\.key \? 'page' : undefined\}/)
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
