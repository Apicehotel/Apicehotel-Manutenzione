import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('bottom nav sempre a 5 voci: Housekeeping non entra mai in nav primaria, solo Planning nello slot opzionale', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  // Direttiva esplicita: 'Housekeeping NON deve stare nella bottom navigation', nessuna
  // eccezione. Lo slot opzionale (oltre Home/Segnalazioni/+/Altro) è riservato solo a Planning.
  assert.doesNotMatch(app, /showHousekeeping/)
  assert.doesNotMatch(app, /key: 'Housekeeping'/)
  // Resta comunque raggiungibile dal pannello Altro (nessuna funzione persa).
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

test('Home mobile: sezione Attività recenti, riusa hotelIssues già presente (nessuna nuova fetch)', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /const recentIssues = useMemo\(\(\) => \[\.\.\.hotelIssues\]\.sort\(\(a, b\) => b\.id - a\.id\)\.slice\(0, 3\), \[hotelIssues\]\)/)
  assert.match(app, /recentIssues=\{recentIssues\}/)
  assert.match(app, /onOpenRecent=\{\(id\) => \{ setTab\('Segnalazioni'\); setOpenIssueId\(id\) \}\}/)
  assert.match(app, /<div className="dash-recent"><h2>Attività recenti<\/h2>/)
  assert.match(app, /<strong>Nessuna attività recente<\/strong><span>Le ultime attività appariranno qui<\/span>/)
  assert.match(app, /recentIssues\.slice\(0, 3\)\.map\(\(issue\) =>/)
  assert.match(styles, /\.dash-recent \{ margin-top: 22px; \}/)
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
