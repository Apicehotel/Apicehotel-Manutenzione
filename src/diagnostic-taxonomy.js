const normalize = (value) => String(value ?? '').trim()
const lower = (value) => normalize(value).toLowerCase()

const RULES = [
  { category: 'auth', label: 'Autenticazione', test: /jwt|session|auth|token expired|refresh token|user not authenticated|unauthorized|401/i, guidance: 'Verifica la sessione. Se il problema continua, esci e accedi di nuovo.' },
  { category: 'permissions', label: 'Permessi', test: /row level security|permission denied|forbidden|not allowed|42501|403/i, guidance: 'L’operazione non è autorizzata per questo ruolo o questa struttura. Verifica i permessi prima di riprovare.' },
  { category: 'offline-sync', label: 'Sincronizzazione offline', test: /offline sync|offline queue|conflict|offline_conflict|coda offline|sincronizz/i, guidance: 'I dati locali restano protetti. Torna online e usa “Riprova sincronizzazione”; i conflitti bloccati richiedono revisione.' },
  { category: 'notifications', label: 'Notifiche', test: /ntfy|push|subscription|notification|webpush|vapid/i, guidance: 'Controlla connessione e configurazione notifiche della struttura, poi usa il recupero sicuro disponibile.' },
  { category: 'import', label: 'File / importazione', test: /xls|xlsx|spreadsheet|workbook|import|file|parser|foglio/i, guidance: 'Controlla che il file sia quello previsto e non sia vuoto o danneggiato; nessun dato parziale deve essere considerato valido.' },
  { category: 'database', label: 'Database / Supabase', test: /supabase|postgres|postgrest|database|constraint|foreign key|duplicate key|23505|23503|not-null|not null/i, guidance: 'Il backend ha rifiutato o non completato l’operazione. Non duplicare l’invio: aggiorna lo stato e riprova una sola volta.' },
  { category: 'network', label: 'Rete', test: /load failed|failed to fetch|network|timeout|connection|gateway|502|503|504|offline/i, guidance: 'La rete non è affidabile. Se l’operazione è supportata offline, RandApp la conserva e la sincronizza al ritorno online.' },
  { category: 'backend', label: 'Funzione backend', test: /edge function|function invoke|worker|cron|job|rpc/i, guidance: 'Un servizio backend non ha completato il lavoro. Aggiorna Diagnostica e usa solo le azioni di recupero sicuro mostrate.' },
  { category: 'app', label: 'App / interfaccia', test: /typeerror|referenceerror|syntaxerror|react|render|chunk|module|javascript|window-error|unhandled-rejection/i, guidance: 'Aggiorna RandApp. Se il problema si ripete, comunica il codice RAND mostrato in Diagnostica.' },
]

function fnv1a(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function classifyDiagnostic(input = {}) {
  const haystack = [input.kind, input.message, input.detail, input.route].map(normalize).join(' ')
  const rule = RULES.find((item) => item.test.test(haystack)) || {
    category: 'unknown',
    label: 'Da classificare',
    guidance: 'Aggiorna Diagnostica e comunica il codice RAND insieme all’operazione che stavi eseguendo.',
  }
  return { category: rule.category, categoryLabel: rule.label, guidance: rule.guidance }
}

export function diagnosticReference(input = {}) {
  const classification = classifyDiagnostic(input)
  const stable = [
    input.hotel_id || input.hotelId || 'no-hotel',
    classification.category,
    lower(input.kind),
    lower(input.message),
    lower(input.route),
  ].join('|')
  return `RAND-${fnv1a(stable).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)}`
}

export function enrichDiagnostic(input = {}) {
  const classification = classifyDiagnostic(input)
  return { ...input, ...classification, reference: diagnosticReference(input) }
}

export function userDiagnosticMessage(error, context = {}) {
  const enriched = enrichDiagnostic({
    ...context,
    message: error?.message || String(error || 'Errore non specificato'),
    detail: error?.stack || '',
  })
  return {
    reference: enriched.reference,
    category: enriched.category,
    title: enriched.categoryLabel,
    message: enriched.guidance,
  }
}

export function deriveDiagnosticStatus({ snapshot = null, operational = null } = {}) {
  const offline = snapshot?.services?.offlineQueue?.value || {}
  const localQueue = Number(snapshot?.localDiagnosticQueue || 0)
  const backend = operational?.status || 'unknown'
  const online = snapshot?.platform?.online !== false
  if (!online && Number(offline.blocked || 0) > 0) return { status: 'problem', label: 'Degradata', reason: `${offline.blocked} operazioni bloccate mentre il dispositivo è offline` }
  if (!online) return { status: 'warning', label: 'Operativa offline', reason: `${Number(offline.pending || 0)} operazioni in attesa di sincronizzazione` }
  if (Number(offline.blocked || 0) > 0) return { status: 'problem', label: 'Degradata', reason: `${offline.blocked} operazioni richiedono intervento` }
  if (backend === 'problem' || backend === 'error') return { status: 'problem', label: 'Degradata', reason: 'Uno o più servizi di produzione hanno un problema' }
  if (backend === 'warning' || backend === 'unknown' || Number(offline.pending || 0) > 0 || localQueue > 0) return { status: 'warning', label: 'Operativa con avvisi', reason: `${Number(offline.pending || 0)} sync in attesa · ${localQueue} log locali` }
  return { status: 'ok', label: 'Operativa', reason: 'Nessun problema operativo rilevato' }
}

export const DIAGNOSTIC_CATEGORIES = RULES.map(({ category, label }) => ({ category, label }))
