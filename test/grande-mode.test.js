import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('modalità Grande: nessun font-size fisso tra 9 e 14px, scaling via custom properties', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  // Nessuno zoom CSS (richiesto esplicitamente, verificato anche in ui-scale.test.js).
  assert.doesNotMatch(styles, /zoom:/)

  // Variabili per i testi secondari, definite e scalate nelle 3 modalità.
  assert.match(styles, /--font-xs: 11px;/)
  assert.match(styles, /--font-sm: 13px;/)
  assert.match(styles, /html\[data-ui-size="small"\][^}]*--font-xs: 10px;/s)
  assert.match(styles, /html\[data-ui-size="large"\][^}]*--font-xs: 16px;/s)
  assert.match(styles, /html\[data-ui-size="large"\][^}]*--font-sm: 19px;/s)

  // Nessun font-size fisso residuo tra 9 e 14.x px in tutto il foglio di stile.
  const leftover = styles.match(/font-size:\s*(9|1[0-4])(\.5)?px/g) || []
  assert.deepEqual(leftover, [])

  // line-height relativo sui badge (non taglia il testo quando --font-xs cresce in Grande).
  assert.doesNotMatch(styles, /\.tab-badge \{[^}]*line-height:\s*\d+px/)
  assert.doesNotMatch(styles, /\.app-nav-badge \{[^}]*line-height:\s*\d+px/)
})

test('modalità Grande: bottom nav, header, filtri e calendario Planning possono andare a capo invece di troncare', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /html\[data-ui-size="large"\] \.app-nav button span,\nhtml\[data-ui-size="large"\] \.hotel-identity strong,\nhtml\[data-ui-size="large"\] \.hotel-identity small,\nhtml\[data-ui-size="large"\] \.urgent-filters button,\nhtml\[data-ui-size="large"\] \.work-event span,\nhtml\[data-ui-size="large"\] \.sale-event span \{\n  white-space: normal;/)
})

test('modalità Grande: i controlli restano cliccabili (min-height via --control-h) senza distinzione per modalità', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /^button:not\(\.icon-button\):not\(\.panel-close\):not\(\.form-close\):not\(\.hk-sheet > header button\):not\(\.sale-event > button\):not\(\.dot\) \{ min-height: var\(--control-h\); \}$/m)
  assert.match(styles, /^input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select \{ min-height: var\(--control-h\); \}$/m)
})

test('Home mobile semplificata: struttura/utente in alto, 4 card sintetiche, azione primaria evidente', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  // Struttura e utente/ruolo sono già in header (.ops-header, sopra la Home), non duplicati inutilmente.
  assert.match(app, /<div className="hotel-identity"><HotelMark hotel=\{hotel\} \/><span><strong>\{hotel\.name\}<\/strong><small>\{user\.name\} · \{user\.role\}<\/small>/)

  // Le 4 card richieste, in quest'ordine.
  assert.match(app, /<strong>Segnalazioni aperte<\/strong>/)
  assert.match(app, /<strong>Urgenti<\/strong>/)
  assert.match(app, /<strong>Interventi di oggi<\/strong>/)
  assert.match(app, /<strong>Da prendere in carico<\/strong>/)

  // Azione primaria evidente.
  assert.match(app, /className="dash-quick"><button type="button" onClick=\{onNewIssue\}>＋ Nuova segnalazione<\/button>/)

  // Interventi di oggi = filtrato sulla data odierna, non solo "pianificati" generici.
  assert.match(app, /todayPlannedCount = hotelPlanned\.filter\(\(item\) => item\.status !== 'done' && item\.scheduledAt <= todayEnd\.getTime\(\) && \(item\.scheduledUntil \|\| item\.scheduledAt\) >= todayStart\.getTime\(\)\)/)

  // Da prendere in carico = avvisi urgenti non ancora presi in carico.
  assert.match(app, /pendingUrgentCount = urgentItems\.filter\(\(item\) => item\.hotelId === hotel\.id && item\.status === 'aperta'\)\.length/)
})

test('Home desktop non impoverita: la card Planning lavori resta, nascosta solo su mobile', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /className="dash-card dash-card-desktop-only"/)
  assert.match(styles, /\.dash-card-desktop-only \{ display: none; \}/)
  assert.match(styles, /@media \(min-width: 701px\) \{\n  \.dash-cards \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 14px; \}\n  \.dash-card-desktop-only \{ display: flex; \}/)
})
