import { useEffect, useMemo, useState } from 'react'
import { HOTELS } from './config.js'
import { fetchIssues, subscribeIssues, updateIssueRow } from './issues-data.js'

const STATUS_LABELS = {
  nuova: 'Nuova',
  new: 'Nuova',
  assegnata: 'Assegnata',
  assigned: 'Assegnata',
  in_corso: 'In corso',
  progress: 'In corso',
  tecnico: 'Tecnico',
  done: 'Risolta',
}

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, bassa: 3 }
const normalize = (value) => String(value || '').trim().toLowerCase()
const statusLabel = (status) => STATUS_LABELS[status] || status || '—'

function StatCard({ label, value, hint }) {
  return <article className="randai-stat"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</article>
}

function IssueDrawer({ issue, onClose, onUpdate }) {
  if (!issue) return null
  const hotel = HOTELS.find((item) => item.id === issue.hotelId)
  return <aside className="randai-drawer" aria-label="Dettaglio segnalazione">
    <div className="randai-drawer-head"><div><small>{hotel?.name || issue.hotelId}</small><h2>{issue.title || 'Segnalazione'}</h2></div><button onClick={onClose} aria-label="Chiudi">×</button></div>
    <div className="randai-drawer-grid">
      <div><span>Camera / zona</span><strong>{issue.room || '—'}</strong></div>
      <div><span>Priorità</span><strong>{issue.urgency || '—'}</strong></div>
      <div><span>Categoria</span><strong>{issue.category || '—'}</strong></div>
      <div><span>Stato</span><strong>{statusLabel(issue.status)}</strong></div>
      <div><span>Creato da</span><strong>{issue.createdByName || '—'}</strong></div>
      <div><span>Data</span><strong>{issue.date || '—'}</strong></div>
    </div>
    {issue.photoData && <img className="randai-photo" src={issue.photoData} alt="Foto segnalazione" />}
    {issue.completionPhotoData && <img className="randai-photo" src={issue.completionPhotoData} alt="Foto completamento" />}
    <div className="randai-drawer-actions">
      <button onClick={() => onUpdate(issue.id, { status: 'in_corso' })}>In corso</button>
      <button onClick={() => onUpdate(issue.id, { status: 'tecnico' })}>Tecnico</button>
      <button className="primary" onClick={() => onUpdate(issue.id, { status: 'done', completedAt: Date.now() })}>Risolta</button>
    </div>
  </aside>
}

export function RandAIConsole({ user, onExit }) {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hotelId, setHotelId] = useState('all')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('recent')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    const results = await Promise.all(HOTELS.map(async (hotel) => {
      const result = await fetchIssues(hotel.id)
      return result.issues || []
    }))
    setIssues(results.flat())
    setLoading(false)
  }

  useEffect(() => {
    load()
    const cleanups = HOTELS.map((hotel) => subscribeIssues(hotel.id, load))
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  const filtered = useMemo(() => {
    const query = normalize(search)
    const rows = issues.filter((issue) => {
      if (hotelId !== 'all' && issue.hotelId !== hotelId) return false
      if (status !== 'all' && normalize(issue.status) !== status) return false
      if (priority !== 'all' && normalize(issue.urgency) !== priority) return false
      if (!query) return true
      return [issue.title, issue.room, issue.category, issue.department, issue.createdByName, issue.origin]
        .some((value) => normalize(value).includes(query))
    })
    return [...rows].sort((a, b) => {
      if (sortBy === 'priority') return (PRIORITY_ORDER[normalize(a.urgency)] ?? 9) - (PRIORITY_ORDER[normalize(b.urgency)] ?? 9)
      return (b.createdAt || 0) - (a.createdAt || 0)
    })
  }, [issues, hotelId, status, priority, search, sortBy])

  const totals = useMemo(() => ({
    all: issues.length,
    open: issues.filter((item) => normalize(item.status) !== 'done').length,
    urgent: issues.filter((item) => ['urgente','alta'].includes(normalize(item.urgency))).length,
    done: issues.filter((item) => normalize(item.status) === 'done').length,
  }), [issues])

  const updateIssue = async (id, changes) => {
    const updated = await updateIssueRow(id, changes)
    if (!updated) return setMessage('Aggiornamento non riuscito')
    setIssues((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item))
    setSelected((current) => current?.id === id ? { ...current, ...updated } : current)
    setMessage('Segnalazione aggiornata')
  }

  return <div className="randai-shell">
    <aside className="randai-sidebar">
      <div className="randai-brand"><strong>RandAI</strong><span>Control Center</span></div>
      <nav>
        <button className="active">Dashboard</button><button>Segnalazioni</button><button>Bozze</button><button>Approvazioni</button><button>Archivio</button><button>Impianti</button><button>Manutenzioni</button><button>Scadenze</button><button>Media & Drive</button><button>Team & ruoli</button><button>Audit log</button>
      </nav>
      <button className="randai-exit" onClick={onExit}>Torna a RandApp</button>
    </aside>

    <main className="randai-main">
      <header className="randai-topbar">
        <div><h1>Console amministrativa</h1><p>Controllo operativo multi-hotel in tempo reale</p></div>
        <div className="randai-user"><span>{user?.name || 'Admin'}</span><small>{user?.role || 'RandAI'}</small></div>
      </header>

      <section className="randai-stats">
        <StatCard label="Segnalazioni" value={totals.all} hint="totali" />
        <StatCard label="Aperte" value={totals.open} hint="da gestire" />
        <StatCard label="Priorità alte" value={totals.urgent} hint="urgenti / alte" />
        <StatCard label="Risolte" value={totals.done} hint="completate" />
      </section>

      <section className="randai-toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca segnalazioni, camere, reparti…" />
        <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}><option value="all">Tutte le strutture</option>{HOTELS.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Tutti gli stati</option><option value="nuova">Nuova</option><option value="in_corso">In corso</option><option value="tecnico">Tecnico</option><option value="done">Risolta</option></select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">Tutte le priorità</option><option value="urgente">Urgente</option><option value="alta">Alta</option><option value="media">Media</option><option value="bassa">Bassa</option></select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="recent">Più recenti</option><option value="priority">Priorità</option></select>
        <button onClick={load}>Aggiorna</button>
      </section>

      {message && <p className="randai-message" role="status">{message}</p>}
      <section className="randai-table-card">
        <div className="randai-table-head"><strong>Segnalazioni</strong><span>{filtered.length} risultati</span></div>
        {loading ? <div className="randai-empty">Caricamento…</div> : filtered.length === 0 ? <div className="randai-empty">Nessuna segnalazione trovata.</div> : <div className="randai-table-wrap"><table><thead><tr><th>Struttura</th><th>Camera / zona</th><th>Problema</th><th>Priorità</th><th>Stato</th><th>Reparto</th><th>Data</th></tr></thead><tbody>{filtered.map((issue) => {
          const hotel = HOTELS.find((item) => item.id === issue.hotelId)
          return <tr key={issue.id} onClick={() => setSelected(issue)}><td>{hotel?.short || issue.hotelId}</td><td>{issue.room || '—'}</td><td><strong>{issue.title || 'Segnalazione'}</strong><small>{issue.category || '—'}</small></td><td><span className={`randai-badge priority-${normalize(issue.urgency)}`}>{issue.urgency || '—'}</span></td><td><span className={`randai-badge status-${normalize(issue.status)}`}>{statusLabel(issue.status)}</span></td><td>{issue.department || '—'}</td><td>{issue.date || '—'}</td></tr>
        })}</tbody></table></div>}
      </section>
    </main>
    <IssueDrawer issue={selected} onClose={() => setSelected(null)} onUpdate={updateIssue} />
  </div>
}
