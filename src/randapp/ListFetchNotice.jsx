import SystemState from './randui/system-states.jsx'

/**
 * Honest list fetch feedback.
 * - ok: silent
 * - !ok + cached rows: compact stale/offline banner above the list
 * - !ok + no rows: full offline/error state (never a false empty)
 */
export default function ListFetchNotice({
  ok = true,
  offline = false,
  hasItems = false,
  onRetry,
  loading = false,
  resourceLabel = 'lista',
}) {
  if (loading || ok) return null

  const state = hasItems
    ? (offline ? 'offline' : 'stale')
    : (offline ? 'offline' : 'error')
  const title = hasItems
    ? (offline ? 'Sei offline' : 'Dati non aggiornati')
    : (offline ? 'Sei offline' : 'Caricamento non riuscito')
  const message = hasItems
    ? (offline
      ? `Mostro l’ultima ${resourceLabel} salvata sul dispositivo. Tocca Riprova quando torna la rete.`
      : `Mostro l’ultima ${resourceLabel} in cache. Tocca Riprova per aggiornare.`)
    : (offline
      ? `Nessuna ${resourceLabel} in cache per questa struttura. Riprova quando torna la rete.`
      : `Impossibile caricare la ${resourceLabel}. Controlla la connessione e riprova.`)

  return (
    <div className="rs-list-fetch-notice" data-testid="list-fetch-notice" data-fetch-state={state} data-has-cache={hasItems ? 'true' : 'false'}>
      <SystemState
        compact={hasItems}
        state={state}
        title={title}
        message={message}
        actionLabel="Riprova"
        onAction={onRetry}
      />
    </div>
  )
}
