import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Spinner } from '../ui.jsx'
import {
  clearDiagnosticEvents,
  fetchDiagnosticIncidents,
  fetchRecentDiagnosticEvents,
  flushDiagnosticEvents,
  getDiagnosticsSnapshot,
  getOperationalHealth,
  repairPushForHotel,
  retryFailedUrgentJob,
  retryOfflineSync,
} from '../../diagnostics-client.js'
import { deriveDiagnosticStatus } from '../../diagnostic-taxonomy.js'
import { loadSession } from '../../session.js'
import './diagnostics.css'

const fmtBytes = (value = 0) => {
  const n = Number(value || 0)
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / (1024 ** i)).toFixed(i ? 1 : 0)} ${units[i]}`
}
const statusTone = (status) => status === 'ok' ? 'done' : status === 'warning' || status === 'unknown' ? 'waiting' : 'high'
const statusText = (status) => status === 'ok' ? 'Operativo' : status === 'warning' ? 'Attenzione' : status === 'unknown' ? 'Da verificare' : 'Problema'
const checkOk = (check) => Boolean(check?.ok)

function HealthRow({ label, status = 'ok', detail }) {
  return <div className="rs-diag-row">
    <div><strong>{label}</strong><small>{detail}</small></div>
    <Badge tone={statusTone(status)}>{statusText(status)}</Badge>
  </div>
}

function eventLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('it-IT')
}

export default function DiagnosticsTab() {
  const session = useMemo(() => loadSession(), [])
  const hotelId = session?.hotelId || null
  const [snapshot, setSnapshot] = useState(null)
  const [operational, setOperational] = useState(null)
  const [events, setEvents] = useState([])
  const [incidents, setIncidents] = useState([])
  const [busy, setBusy] = useState(true)
  const [repairing, setRepairing] = useState('')
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setBusy(true); setMessage('')
    try {
      await flushDiagnosticEvents()
      const [nextSnapshot, nextOperational, nextEvents, nextIncidents] = await Promise.all([
        getDiagnosticsSnapshot({ hotelId }),
        getOperationalHealth(hotelId),
        fetchRecentDiagnosticEvents(hotelId),
        fetchDiagnosticIncidents(hotelId),
      ])
      setSnapshot(nextSnapshot)
      setOperational(nextOperational)
      setEvents(nextEvents)
      setIncidents(nextIncidents)
    } catch (error) {
      setMessage(error?.message || 'Diagnostica non disponibile')
    } finally { setBusy(false) }
  }

  useEffect(() => { refresh() }, [])

  const copyReport = async () => {
    try {
      const report = JSON.stringify({ snapshot, operational, incidents, events }, null, 2)
      await navigator.clipboard.writeText(report)
      setMessage('Report diagnostico copiato negli appunti.')
    } catch { setMessage('Impossibile copiare automaticamente il report.') }
  }

  const clearEvents = async () => {
    if (!window.confirm('Eliminare gli eventi diagnostici registrati per questa struttura?')) return
    try {
      await clearDiagnosticEvents(hotelId)
      setEvents([]); setIncidents([])
      setMessage('Registro diagnostico pulito.')
    } catch (error) { setMessage(error?.message || 'Pulizia non riuscita') }
  }

  const repairPush = async () => {
    setRepairing('push'); setMessage('')
    try {
      const ok = await repairPushForHotel(hotelId)
      setMessage(ok ? 'Subscription push riallineata.' : 'Nessuna subscription push da riparare.')
      await refresh()
    } catch (error) { setMessage(error?.message || 'Ripristino push non riuscito') }
    finally { setRepairing('') }
  }

  const retrySync = async () => {
    setRepairing('offline'); setMessage('')
    try {
      const result = await retryOfflineSync()
      if (result.reason === 'offline') setMessage('Dispositivo offline: la coda resta protetta e verrà riprovata al ritorno della rete.')
      else if (result.blocked) setMessage(`Sincronizzazione eseguita: ${result.blocked} operazioni richiedono revisione manuale.`)
      else setMessage(result.pending ? `${result.pending} operazioni ancora in attesa di retry automatico.` : 'Coda offline sincronizzata.')
      await refresh()
    } catch (error) { setMessage(error?.message || 'Sincronizzazione non riuscita') }
    finally { setRepairing('') }
  }

  const retryUrgent = async (jobId) => {
    setRepairing(jobId); setMessage('')
    try {
      const ok = await retryFailedUrgentJob(hotelId, jobId)
      setMessage(ok ? 'Job urgente rimesso in coda in sicurezza.' : 'Il job non era più in stato fallito.')
      await refresh()
    } catch (error) { setMessage(error?.message || 'Retry non riuscito') }
    finally { setRepairing('') }
  }

  if (busy && !snapshot) return <Spinner label="Controllo salute RandApp…" />

  const svc = snapshot?.services || {}
  const offlineValue = svc.offlineQueue?.value || {}
  const swValue = svc.serviceWorker?.value || {}
  const pushValue = svc.push?.value || {}
  const ntfyValue = svc.ntfy?.value || {}
  const storage = snapshot?.storage
  const build = snapshot?.build || {}
  const telemetry = snapshot?.telemetry || {}
  const overall = deriveDiagnosticStatus({ snapshot, operational })
  const failedUrgent = operational?.urgent_jobs?.failed || []

  return <div className="rs-diag">
    <header className="rs-diag-head">
      <div><h2>Diagnostica RandApp</h2><p>Salute di produzione, incidenti classificati e recupero operativo sicuro.</p></div>
      <Button size="sm" variant="ghost" onClick={refresh} disabled={busy}>{busy ? 'Controllo…' : 'Aggiorna'}</Button>
    </header>

    {message && <p className="rs-diag-message" role="status">{message}</p>}

    <Card className={`rs-diag-overall rs-diag-overall--${overall.status}`}>
      <div><strong>Stato RandApp</strong><span>{overall.label}</span><small>{overall.reason}</small></div>
      <Badge tone={statusTone(overall.status)}>{overall.label}</Badge>
    </Card>

    <Card className="rs-diag-build">
      <div><strong>Build</strong><span>{build.sha || 'dev'}</span></div>
      <div><strong>Compilata</strong><span>{build.timestamp ? new Date(build.timestamp).toLocaleString('it-IT') : 'sviluppo locale'}</span></div>
      <div><strong>Modalità</strong><span>{snapshot?.platform?.standalone ? 'PWA installata' : 'Browser'}</span></div>
      <div><strong>Rete</strong><span>{snapshot?.platform?.online ? 'Online' : 'Offline'}</span></div>
    </Card>

    <div className="rs-diag-section-head"><h3>Dispositivo e app</h3><small>controlli locali</small></div>
    <section className="rs-diag-grid">
      <Card><HealthRow label="Supabase API" status={checkOk(svc.supabaseApi) ? 'ok' : 'problem'} detail={svc.supabaseApi?.ok ? `${svc.supabaseApi.ms} ms` : (svc.supabaseApi?.error || 'non raggiungibile')} /></Card>
      <Card><HealthRow label="Sessione" status={checkOk(svc.auth) ? 'ok' : 'problem'} detail={svc.auth?.ok ? `verificata in ${svc.auth.ms} ms` : (svc.auth?.error || 'non valida')} /></Card>
      <Card><HealthRow label="Realtime" status={checkOk(svc.realtime) ? 'ok' : 'warning'} detail={checkOk(svc.realtime) ? 'canale collegato' : 'non collegato in questo momento'} /></Card>
      <Card><HealthRow label="Service Worker" status={swValue.registered && swValue.controlled ? 'ok' : 'warning'} detail={swValue.registered ? (swValue.controlled ? 'PWA controllata' : 'registrato, controllo non attivo') : 'non registrato'} /></Card>
      <Card><HealthRow label="Push dispositivo" status={pushValue.supported && pushValue.permission !== 'denied' && pushValue.subscribed ? 'ok' : 'warning'} detail={!pushValue.supported ? 'non supportato' : `${pushValue.permission || 'default'} · ${pushValue.subscribed ? 'iscritto' : 'non iscritto'}`} /></Card>
      <Card><HealthRow label="Coda offline" status={checkOk(svc.offlineQueue) && Number(offlineValue.blocked || 0) === 0 ? 'ok' : 'problem'} detail={`${offlineValue.pending || 0} in attesa · ${offlineValue.blocked || 0} bloccate`} /></Card>
      <Card><HealthRow label="ntfy dispositivo" status={checkOk(svc.ntfy) && Boolean(ntfyValue.verified || !hotelId) ? 'ok' : 'warning'} detail={!hotelId ? 'seleziona una struttura' : `${ntfyValue.configured ? 'configurato' : 'non configurato'} · ${ntfyValue.verified ? 'verificato' : 'non verificato'}`} /></Card>
      <Card><HealthRow label="Diagnostica locale" status={Number(snapshot?.localDiagnosticQueue || 0) === 0 ? 'ok' : 'warning'} detail={`${snapshot?.localDiagnosticQueue || 0} eventi da inviare`} /></Card>
    </section>

    <div className="rs-diag-section-head"><h3>Produzione</h3><small>backend e worker</small></div>
    <section className="rs-diag-grid">
      <Card><HealthRow label="Meteo" status={operational?.weather?.status || 'unknown'} detail={operational?.weather?.last_checked_at ? `ultimo controllo ${eventLabel(operational.weather.last_checked_at)}` : 'nessun controllo registrato'} /></Card>
      <Card><HealthRow label="Sensori" status={operational?.sensors?.status || 'unknown'} detail={`${operational?.sensors?.total || 0} totali · ${operational?.sensors?.stale || 0} vecchi · ${operational?.sensors?.offline || 0} offline`} /></Card>
      <Card><HealthRow label="Job urgenti" status={operational?.urgent_jobs?.status || 'unknown'} detail={`${operational?.urgent_jobs?.failed_24h || 0} falliti 24h · ${operational?.urgent_jobs?.overdue || 0} in ritardo`} /></Card>
      <Card><HealthRow label="Promemoria" status={operational?.reminders?.status || 'unknown'} detail={`${operational?.reminders?.problems_24h || 0} problemi nelle ultime 24h`} /></Card>
      <Card><HealthRow label="Notifiche" status={operational?.notifications?.status || 'unknown'} detail={`${operational?.notifications?.problems_24h || 0} code/errori nelle ultime 24h`} /></Card>
      <Card><HealthRow label="Worker pianificati" status={operational?.cron?.status || 'unknown'} detail={`${operational?.cron?.inactive || 0} job inattivi su ${(operational?.cron?.jobs || []).length}`} /></Card>
      <Card><HealthRow label="Push server" status={operational?.push?.status || 'unknown'} detail={`${operational?.push?.subscriptions || 0} subscription della struttura`} /></Card>
      <Card><HealthRow label="Errori app" status={operational?.diagnostics?.status || 'unknown'} detail={`${operational?.diagnostics?.errors_24h || 0} errori · ${operational?.diagnostics?.fatal_24h || 0} fatali in 24h`} /></Card>
    </section>

    <Card className="rs-diag-telemetry">
      <div className="rs-diag-section-head"><h3>Telemetria esterna</h3><small>opzionale e separata dai log operativi</small></div>
      <div className="rs-diag-grid">
        <HealthRow label="Sentry" status={telemetry.sentry?.enabled ? 'ok' : 'warning'} detail={telemetry.sentry?.enabled ? 'attivo' : telemetry.sentry?.configured ? 'configurato ma disattivato' : 'SDK predisposto · manca DSN'} />
        <HealthRow label="OpenTelemetry" status={telemetry.opentelemetry?.enabled ? 'ok' : 'warning'} detail={telemetry.opentelemetry?.enabled ? 'attivo' : telemetry.opentelemetry?.configured ? 'configurato ma disattivato' : 'SDK predisposto · manca collector OTLP'} />
      </div>
    </Card>

    {storage && <Card className="rs-diag-storage"><strong>Archiviazione dispositivo</strong><span>{fmtBytes(storage.usage)} usati su {fmtBytes(storage.quota)}</span></Card>}

    <div className="rs-diag-actions">
      <Button variant="ghost" onClick={retrySync} disabled={repairing === 'offline'}>{repairing === 'offline' ? 'Sincronizzo…' : 'Riprova sincronizzazione'}</Button>
      <Button variant="ghost" onClick={repairPush} disabled={repairing === 'push'}>{repairing === 'push' ? 'Ripristino…' : 'Ripara push'}</Button>
      <Button variant="ghost" onClick={copyReport}>Copia report</Button>
      <Button variant="ghost" onClick={clearEvents} disabled={!events.length}>Pulisci registro</Button>
    </div>

    {failedUrgent.length > 0 && <section className="rs-diag-events">
      <div className="rs-diag-section-head"><h3>Recupero job urgenti</h3><small>{failedUrgent.length} recenti</small></div>
      {failedUrgent.map((job) => <Card key={job.id} className="rs-diag-event">
        <div className="rs-diag-event__top"><Badge tone="high">fallito</Badge><small>{eventLabel(job.updated_at)}</small></div>
        <strong>{job.error || 'Errore non specificato'}</strong>
        <Button size="sm" variant="ghost" onClick={() => retryUrgent(job.id)} disabled={repairing === job.id}>{repairing === job.id ? 'Riprovo…' : 'Rimetti in coda'}</Button>
      </Card>)}
    </section>}

    <section className="rs-diag-events">
      <div className="rs-diag-section-head"><h3>Incidenti raggruppati</h3><small>ultimi 7 giorni</small></div>
      {!incidents.length ? <EmptyState icon="check" title="Nessun incidente attivo">Non risultano pattern di errore recenti per questa struttura.</EmptyState> : incidents.map((incident, index) => (
        <Card key={`${incident.kind}-${incident.message}-${incident.route}-${index}`} className="rs-diag-event">
          <div className="rs-diag-event__top"><div><Badge tone={incident.severity === 'fatal' || incident.severity === 'error' ? 'high' : 'waiting'}>{incident.occurrences}× {incident.severity}</Badge> <Badge>{incident.reference}</Badge></div><small>{eventLabel(incident.last_seen)}</small></div>
          <strong>{incident.message}</strong>
          <p>{incident.categoryLabel} · {incident.kind} · {incident.route || '—'} · build {incident.app_build || '—'}</p>
          <small>{incident.guidance}</small>
          <small>Prima occorrenza: {eventLabel(incident.first_seen)}</small>
        </Card>
      ))}
    </section>

    <section className="rs-diag-events">
      <div className="rs-diag-section-head"><h3>Eventi recenti</h3><small>{events.length} registrati</small></div>
      {!events.length ? <EmptyState icon="check" title="Nessun errore registrato">Non risultano errori recenti accessibili per questa struttura.</EmptyState> : events.map((event) => (
        <Card key={event.id} className="rs-diag-event">
          <div className="rs-diag-event__top"><div><Badge tone={event.severity === 'fatal' || event.severity === 'error' ? 'high' : 'waiting'}>{event.severity}</Badge> <Badge>{event.reference}</Badge></div><small>{eventLabel(event.created_at)}</small></div>
          <strong>{event.message}</strong>
          <p>{event.categoryLabel} · {event.kind} · {event.route || '—'} · build {event.app_build || '—'}</p>
          <small>{event.guidance}</small>
          {event.detail && <details><summary>Dettagli tecnici</summary><pre>{event.detail}</pre></details>}
        </Card>
      ))}
    </section>
  </div>
}
