import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase.js'

// Portale leggero per i Tecnici esterni: nessun login, nessun PIN. Il token
// nell'URL (/tecnico/<token>) è l'unica credenziale — vedi l'edge function
// tech-portal, che verifica ogni azione contro l'assegnazione reale.

const URGENCY_LABEL = { alta: 'Alta', media: 'Media', bassa: 'Bassa' }

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

function JobCard({ item, onSetArrival, onComplete, busy }) {
  const [arrivalDraft, setArrivalDraft] = useState(toLocalInputValue(item.expectedArrival))
  const [editingArrival, setEditingArrival] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [note, setNote] = useState('')

  return <article className="tech-job-card">
    <div className="tech-job-head">
      <strong>{item.room}</strong>
      <span className="tech-job-hotel">{item.hotelName}</span>
    </div>
    <p className="tech-job-title">{item.title || item.category}</p>
    <div className="tech-job-meta">
      <span>{item.category}</span>
      {item.urgency && <span className={`urgency badge-${item.urgency}`}>{URGENCY_LABEL[item.urgency] || item.urgency}</span>}
      {item.scheduledAt && <span>Programmato: {formatDateTime(item.scheduledAt)}</span>}
    </div>
    {item.expectedArrival && !editingArrival && <p className="tech-job-eta">🚚 Arrivo comunicato: {formatDateTime(item.expectedArrival)}</p>}
    {editingArrival ? <div className="inline-form">
      <label>Quando pensi di arrivare?<input type="datetime-local" value={arrivalDraft} onChange={(e) => setArrivalDraft(e.target.value)} /></label>
      <div className="inline-form-actions">
        <button className="secondary" onClick={() => setEditingArrival(false)} disabled={busy}>Annulla</button>
        <button className="primary" disabled={!arrivalDraft || busy} onClick={async () => { await onSetArrival(item, arrivalDraft); setEditingArrival(false) }}>Salva orario</button>
      </div>
    </div> : <button className="secondary tech-job-action" onClick={() => setEditingArrival(true)} disabled={busy}>{item.expectedArrival ? 'Cambia orario di arrivo' : 'Comunica quando arrivi'}</button>}
    {completing ? <div className="inline-form">
      <label>Note (facoltative)<textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cosa hai fatto" /></label>
      <div className="inline-form-actions">
        <button className="secondary" onClick={() => setCompleting(false)} disabled={busy}>Annulla</button>
        <button className="primary" disabled={busy} onClick={async () => { await onComplete(item, note); setCompleting(false) }}>Conferma completato</button>
      </div>
    </div> : <button className="primary tech-job-action" onClick={() => setCompleting(true)} disabled={busy}>✓ Segna completato</button>}
  </article>
}

export default function TechnicianPortal({ token }) {
  const [state, setState] = useState('loading') // loading | ok | error
  const [technicianName, setTechnicianName] = useState('')
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const load = async () => {
    if (!isSupabaseConfigured) { setState('error'); setErrorMessage('App non configurata'); return }
    try {
      const { data, error } = await supabase.functions.invoke('tech-portal', { body: { action: 'list', token } })
      if (error || data?.ok === false) { setState('error'); setErrorMessage(data?.error || 'Link non valido'); return }
      setTechnicianName(data.technician?.name || '')
      setItems(data.items || [])
      setState('ok')
    } catch {
      setState('error'); setErrorMessage('Errore di connessione')
    }
  }

  useEffect(() => { load() }, [token])

  const setArrival = async (item, arrivalLocal) => {
    setBusyId(item.id)
    try {
      const arrivalIso = arrivalLocal ? new Date(arrivalLocal).toISOString() : null
      await supabase.functions.invoke('tech-portal', { body: { action: 'set_arrival', token, kind: item.kind, id: item.id, arrival_at: arrivalIso } })
      await load()
    } finally { setBusyId(null) }
  }

  const complete = async (item, note) => {
    setBusyId(item.id)
    try {
      await supabase.functions.invoke('tech-portal', { body: { action: 'complete', token, kind: item.kind, id: item.id, note } })
      await load()
    } finally { setBusyId(null) }
  }

  return <div className="tech-portal">
    <header className="tech-portal-header"><strong>RandApp · Portale tecnico</strong>{technicianName && <span>{technicianName}</span>}</header>
    <main className="tech-portal-main">
      {state === 'loading' && <p className="tech-portal-status">Caricamento…</p>}
      {state === 'error' && <p className="tech-portal-status tech-portal-error">{errorMessage}</p>}
      {state === 'ok' && (items.length ? items.map((item) => <JobCard key={`${item.kind}-${item.id}`} item={item} onSetArrival={setArrival} onComplete={complete} busy={busyId === item.id} />) : <p className="tech-portal-status">Nessun lavoro assegnato al momento.</p>)}
    </main>
  </div>
}
