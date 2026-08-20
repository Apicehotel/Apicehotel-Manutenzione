import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('bottom nav sempre a 5 voci: Housekeeping non compare in nav primaria quando Planning è già presente', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  // Direttore Centro Congressi ha sia canViewPlanningMenu che canViewHousekeeping:
  // senza questa condizione la nav avrebbe 6 voci (Home, Segnalazioni, +, Planning,
  // Housekeeping, Altro) invece delle 5 richieste dal mockup.
  assert.match(app, /showHousekeeping=\{canViewHousekeeping\(user\) && !canViewPlanningMenu\(user\)\}/)
  // Resta comunque raggiungibile dal pannello Altro in quel caso (nessuna funzione persa).
  assert.match(app, /canViewHousekeeping\(user\) && <button onClick=\{\(\) => \{ setTab\('Housekeeping'\)/)
})

test('nessun pulsante rosso duplicato: Avvisi Urgenti ha un FAB scoped alla propria pagina, non più un secondo pulsante fisso globale', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  // Prima: canSendUrgent(user) mostrava un FAB rosso fisso su OGNI tab, in parallelo
  // al + verde centrale sempre presente per lo stesso utente (entrambi hanno anche
  // permesso 'create') — due pulsanti flottanti contemporanei, confusione visiva.
  assert.doesNotMatch(app, /\{canSendUrgent\(user\) && <button className="urgent-fab" onClick=\{\(\) => \{ setTab/)
  // Ora: stesso pattern già usato per Interventi/Planning Lavori, un FAB dedicato
  // visibile solo quando si è già sulla pagina Avvisi Urgenti.
  assert.match(app, /\{tab === 'Avvisi Urgenti' && canSendUrgent\(user\) && <button className="fab-new-issue planned-fab urgent-fab-scoped" onClick=\{\(\) => setUrgentComposeRequest/)
  assert.match(styles, /\.urgent-fab-scoped \{ background:#c81e1e !important;/)
  // Nessun residuo della vecchia posizione fissa standalone.
  assert.doesNotMatch(styles, /^\.urgent-fab \{/m)
})

test('fascia "Dati sincronizzati con Supabase" non più permanente: nulla se online e configurato, avviso solo se offline o non configurato', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /const \[online, setOnline\] = useState\(\(\) => typeof navigator === 'undefined' \|\| navigator\.onLine\)/)
  assert.match(app, /window\.addEventListener\('online', goOnline\); window\.addEventListener\('offline', goOffline\)/)
  // La fascia ora si rende SOLO quando c'è qualcosa da segnalare (offline o non configurato),
  // non più sempre — prima mostrava "Dati sincronizzati con Supabase" incondizionatamente.
  assert.match(app, /\{!\['Temperature','Housekeeping'\]\.includes\(tab\) && \(!online \|\| !isSupabaseConfigured\) && <p className=\{`local-data-note \$\{!online \? 'offline' : ''\}`\}>/)
  assert.doesNotMatch(app, /Dati sincronizzati con Supabase/)
  assert.match(styles, /\.local-data-note\.offline \{ background: #fff7dc;/)
})
