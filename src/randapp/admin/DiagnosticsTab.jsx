import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Spinner } from '../ui.jsx'
import { clearDiagnosticEvents, fetchRecentDiagnosticEvents, flushDiagnosticEvents, getDiagnosticsSnapshot } from '../../diagnostics-client.js'
import { loadSession } from '../../session.js'
import './diagnostics.css'

const fmtBytes = (value = 0) => {
  const n = Number(value || 0)
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / (1024 ** i)).toFixed(i ? 1 : 0)} ${units[i]}`
}
const statusTone = (ok) => ok ? 'done' : 'high'
const statusText = (ok) => ok ? 'OK' : 'Problema'
const checkOk = (check) => Boolean(check?.ok)

function HealthRow({ label, ok, detail }) {
  return <div className="rs-diag-row">
    <div><strong>{label}</strong><small>{detail}</small></div>
    <Badge tone={statusTone(ok)}>{statusText(ok)}</Badge>
  </div>
}

function eventLabel(event) {
  const date = new Date(event.created_at)
  return Number.isNaN(date.getTime()) ? event.created_at : date.toLocaleString('it-IT')
}

export default function DiagnosticsTab() {
  const session = useMemo(() => loadSession(), [])
  const hotelId = session?.hotelId || null
  const [snapshot, setSnapshot] = useState(null)
  const [events, setEvents] = useState([])
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setBusy(true); setMessage('')
    try {
      await flushDiagnosticEvents()
      const [nextSnapshot, nextEvents] = await Promise.all([
        getDiagnosticsSnapshot({ hotelId }),
        fetchRecentDiagnosticEvents(hotelId),
      ])
      setSnapshot(nextSnapshot)
      setEvents(nextEvents)
    } catch (error) {
      setMessage(error?.message || 'Diagnostica non disponibile')
    } finally { setBusy(false) }
  }

  useEffect(() => { refresh() }, [])

  const copyReport = async () => {
    try {
      const report = JSON.stringify({ snapshot, events }, null, 2)
      await navigator.clipboard.writeText(report)
      setMessage('Report diagnostico copiato negli appunti.')
    } catch { setMessage('Impossibile copiare automaticamente il report.') }
  }

  const clearEvents = async () => {
    if (!window.confirm('Eliminare gli eventi diagnostici registrati per questa struttura?')) return
    try {
      await clearDiagnosticEvents(hotelId)
      setEvents([])
      setMessage('Registro diagnostico pulito.')
    } catch (error) { setMessage(error?.message || 'Pulizia non riuscita') }
  }

  if (busy && !snapshot) return <Spinner label="Controllo salute RandApp…" />

  const svc = snapshot?.services || {}
  const offlineValue = svc.offlineQueue?.value || {}
  const swValue = svc.serviceWorker?.value || {}
  const pushValue = svc.push?.value || {}
  const ntfyValue = svc.ntfy?.value || {}
  const storage = snapshot?.storage
  const build = snapshot?.build || {}

  return <div className="rs-diag">
    <header className="rs-diag-head">
      <div><h2>Diagnostica RandApp</h2><p>Stato tecnico, versione e problemi reali registrati in produzione.</p></div>
      <Button size="sm" variant="ghost" onClick={refresh} disabled={busy}>{busy ? 'Controllo…' : 'Aggiorna'}</Button>
    </header>

    {message && <p className="rs-diag-message" role="status">{message}</p>}

    <Card className="rs-diag-build">
      <div><strong>Build</strong><span>{build.sha || 'dev'}</span></div>
      <div><strong>Compilata</strong><span>{build.timestamp ? new Date(build.timestamp).toLocaleString('it-IT') : 'sviluppo locale'}</span></div>
      <div><strong>Modalità</strong><span>{snapshot?.platform?.standalone ? 'PWA installata' : 'Browser'}</span></div>
      <div><strong>Rete</strong><span>{snapshot?.platform?.online ? 'Online' : 'Offline'}</span></div>
    </Card>

    <section className="rs-diag-grid">
      <Card><HealthRow label="Supabase API" ok={checkOk(svc.supabaseApi)} detail={svc.supabaseApi?.ok ? `${svc.supabaseApi.ms} ms` : (svc.supabaseApi?.error || 'non raggiungibile')} /></Card>
      <Card><HealthRow label="Sessione" ok={checkOk(svc.auth)} detail={svc.auth?.ok ? `verificata in ${svc.auth.ms} ms` : (svc.auth?.error || 'non valida')} /></Card>
      <Card><HealthRow label="Realtime" ok={checkOk(svc.realtime)} detail={checkOk(svc.realtime) ? 'canale collegato' : 'non collegato in questo momento'} /></Card>
      <Card><HealthRow label="Service Worker" ok={Boolean(swValue.registered && swValue.controlled)} detail={swValue.registered ? (swValue.controlled ? 'PWA controllata' : 'registrato, controllo non attivo') : 'non registrato'} /></Card>
      <Card><HealthRow label="Push" ok={Boolean(pushValue.supported && pushValue.permission !== 'denied' && pushValue.subscribed)} detail={!pushValue.supported ? 'non supportato' : `${pushValue.permission || 'default'} · ${pushValue.subscribed ? 'iscritto' : 'non iscritto'}`} /></Card>
      <Card><HealthRow label="Coda offline" ok={checkOk(svc.offlineQueue) && Number(offlineValue.blocked || 0) === 0} detail={`${offlineValue.pending || 0} in attesa · ${offlineValue.blocked || 0} bloccate`} /></Card>
      <Card><HealthRow label="ntfy" ok={checkOk(svc.ntfy) && Boolean(ntfyValue.verified || !hotelId)} detail={!hotelId ? 'seleziona una struttura' : `${ntfyValue.configured ? 'configurato' : 'non configurato'} · ${ntfyValue.verified ? 'verificato' : 'non verificato'}`} /></Card>
      <Card><HealthRow label="Diagnostica locale" ok={Number(snapshot?.localDiagnosticQueue || 0) === 0} detail={`${snapshot?.localDiagnosticQueue || 0} eventi da inviare`} /></Card>
    </section>

    {storage && <Card className="rs-diag-storage"><strong>Archiviazione dispositivo</strong><span>{fmtBytes(storage.usage)} usati su {fmtBytes(storage.quota)}</span></Card>}

    <div className="rs-diag-actions">
      <Button variant="ghost" onClick={copyReport}>Copia report</Button>
      <Button variant="ghost" onClick={clearEvents} disabled={!events.length}>Pulisci registro</Button>
    </div>

    <section className="rs-diag-events">
      <div className="rs-diag-section-head"><h3>Eventi recenti</h3><small>{events.length} registrati</small></div>
      {!events.length ? <EmptyState icon="check" title="Nessun errore registrato">Non risultano errori recenti accessibili per questa struttura.</EmptyState> : events.map((event) => (
        <Card key={event.id} className="rs-diag-event">
          <div className="rs-diag-event__top"><Badge tone={event.severity === 'fatal' || event.severity === 'error' ? 'high' : 'waiting'}>{event.severity}</Badge><small>{eventLabel(event)}</small></div>
          <strong>{event.message}</strong>
          <p>{event.kind} · {event.route || '—'} · build {event.app_build || '—'}</p>
          {event.detail && <details><summary>Dettagli tecnici</summary><pre>{event.detail}</pre></details>}
        </Card>
      ))}
    </section>
  </div>
}
