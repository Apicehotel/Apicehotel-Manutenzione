import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase.js'

const URGENCY_LABEL = { alta: 'Alta', media: 'Media', bassa: 'Bassa' }
const EVENT_LABEL = { opened: 'Link aperto', arrival_set: 'Arrivo comunicato', started: 'Intervento iniziato', note: 'Nota tecnico', completion_requested: 'Fine intervento comunicata' }

function formatDateTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function JobCard({ item, onSetArrival, onStart, onAddNote, onComplete, busy }) {
  const [arrivalDraft, setArrivalDraft] = useState(toLocalInputValue(item.expectedArrival))
  const [editingArrival, setEditingArrival] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [note, setNote] = useState('')
  const [workNote, setWorkNote] = useState('')
  const awaitingClose = item.awaitingInternalClose || item.status === 'awaiting_internal_close'

  return <article className="tech-job-card">
    <div className="tech-job-head">
      <strong>{item.room || 'Zona'}</strong>
      <span className="tech-job-hotel">{item.hotelName}</span>
    </div>
    <p className="tech-job-title">{item.title || item.category}</p>
    <div className="tech-job-meta">
      <span>{item.category}</span>
      {item.urgency && <span className={`urgency badge-${item.urgency}`}>{URGENCY_LABEL[item.urgency] || item.urgency}</span>}
      {item.scheduledAt && <span>Programmato: {formatDateTime(item.scheduledAt)}</span>}
    </div>
    {item.reason && <p><strong>Richiesta:</strong> {item.reason}</p>}
    {item.authorizationNote && <p><strong>Nota autorizzazione:</strong> {item.authorizationNote}</p>}
    {item.expectedArrival && !editingArrival && <p className="tech-job-eta">🚚 Arrivo comunicato: {formatDateTime(item.expectedArrival)}</p>}

    {!awaitingClose && (editingArrival ? <div className="inline-form">
      <label>Quando pensi di arrivare?<input type="datetime-local" value={arrivalDraft} onChange={(e) => setArrivalDraft(e.target.value)} /></label>
      <div className="inline-form-actions">
        <button className="secondary" onClick={() => setEditingArrival(false)} disabled={busy}>Annulla</button>
        <button className="primary" disabled={!arrivalDraft || busy} onClick={async () => { await onSetArrival(item, arrivalDraft); setEditingArrival(false) }}>Salva orario</button>
      </div>
    </div> : <button className="secondary tech-job-action" onClick={() => setEditingArrival(true)} disabled={busy}>{item.expectedArrival ? 'Cambia orario di arrivo' : 'Comunica quando arrivi'}</button>)}

    {!awaitingClose && item.kind === 'dispatch' && item.status !== 'in_progress' && <button className="primary tech-job-action" onClick={() => onStart(item)} disabled={busy}>▶ Inizia intervento</button>}

    {!awaitingClose && item.kind === 'dispatch' && (addingNote ? <div className="inline-form">
      <label>Aggiungi nota<textarea rows="2" value={workNote} onChange={(e) => setWorkNote(e.target.value)} placeholder="Aggiornamento sull'intervento" /></label>
      <div className="inline-form-actions"><button className="secondary" onClick={() => setAddingNote(false)} disabled={busy}>Annulla</button><button className="primary" disabled={!workNote.trim() || busy} onClick={async () => { await onAddNote(item, workNote); setWorkNote(''); setAddingNote(false) }}>Salva nota</button></div>
    </div> : <button className="secondary tech-job-action" onClick={() => setAddingNote(true)} disabled={busy}>+ Aggiungi nota</button>)}

    {awaitingClose ? <div className="tech-job-eta"><strong>✓ Intervento terminato.</strong><br />Attende verifica e chiusura interna in RandApp.</div> : completing ? <div className="inline-form">
      <label>Note finali (facoltative)<textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cosa hai fatto" /></label>
      <div className="inline-form-actions">
        <button className="secondary" onClick={() => setCompleting(false)} disabled={busy}>Annulla</button>
        <button className="primary" disabled={busy} onClick={async () => { await onComplete(item, note); setCompleting(false) }}>Comunica fine intervento</button>
      </div>
      <small>Questa azione non chiude la segnalazione: la chiusura finale è interna.</small>
    </div> : <button className="primary tech-job-action" onClick={() => setCompleting(true)} disabled={busy}>✓ Intervento terminato · richiedi chiusura</button>}

    {item.events?.length > 0 && <div className="tech-job-meta" style={{ display: 'grid', gap: 5, marginTop: 12 }}>
      <strong>Cronologia</strong>{item.events.map((event) => <span key={event.id}>{formatDateTime(event.created_at)} · {EVENT_LABEL[event.event_type] || event.event_type}{event.note ? ` · ${event.note}` : ''}</span>)}
    </div>}
  </article>
}

export default function TechnicianPortal({ token }) {
  const [state, setState] = useState('loading')
  const [technicianName, setTechnicianName] = useState('')
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const call = async (body) => {
    const { data, error } = await supabase.functions.invoke('tech-portal', { body: { ...body, token } })
    if (error || data?.ok === false) throw new Error(data?.error || error?.message || 'Operazione non riuscita')
    return data
  }

  const load = async () => {
    if (!isSupabaseConfigured) { setState('error'); setErrorMessage('App non configurata'); return }
    try {
      const data = await call({ action: 'list' })
      setTechnicianName(data.technician?.name || '')
      setItems(data.items || [])
      setErrorMessage('')
      setState('ok')
    } catch (error) {
      setState('error'); setErrorMessage(error?.message || 'Errore di connessione')
    }
  }

  useEffect(() => { load() }, [token])

  const runItemAction = async (item, body) => {
    setBusyId(item.id); setErrorMessage('')
    try { await call({ ...body, kind: item.kind, id: item.id }); await load() }
    catch (error) { setErrorMessage(error?.message || 'Operazione non riuscita') }
    finally { setBusyId(null) }
  }

  const setArrival = (item, arrivalLocal) => runItemAction(item, { action: 'set_arrival', arrival_at: arrivalLocal ? new Date(arrivalLocal).toISOString() : null })
  const start = (item) => runItemAction(item, { action: 'start' })
  const addNote = (item, note) => runItemAction(item, { action: 'note', note })
  const complete = (item, note) => runItemAction(item, { action: 'complete', note })

  return <div className="tech-portal">
    <header className="tech-portal-header"><strong>RandApp · Portale tecnico</strong>{technicianName && <span>{technicianName}</span>}</header>
    <main className="tech-portal-main">
      {errorMessage && state === 'ok' && <p className="tech-portal-status tech-portal-error">{errorMessage}</p>}
      {state === 'loading' && <p className="tech-portal-status">Caricamento…</p>}
      {state === 'error' && <p className="tech-portal-status tech-portal-error">{errorMessage}</p>}
      {state === 'ok' && (items.length ? items.map((item) => <JobCard key={`${item.kind}-${item.id}`} item={item} onSetArrival={setArrival} onStart={start} onAddNote={addNote} onComplete={complete} busy={busyId === item.id} />) : <p className="tech-portal-status">Nessun lavoro assegnato al momento.</p>)}
    </main>
  </div>
}
