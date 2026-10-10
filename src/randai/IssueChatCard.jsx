import { useEffect, useState } from 'react'
import { fetchIssues, updateIssueRow } from '../issues-data.js'
import { canUser } from '../permissions.js'
import './IssueChatCard.css'

const normalize = (value) => String(value || '').toLocaleLowerCase('it').trim()
export function issueMatches(issue, search, issueId) {
  if (issueId) return String(issue.id) === String(issueId)
  const words = normalize(search).replace(/[.,!?]/g, ' ').split(/\s+/)
    .filter((word) => word.length > 2 && !['mostrami','segnalazione','segnalazioni','della','del','delle','apri','dettaglio'].includes(word))
  const haystack = normalize([issue.room, issue.title, issue.category].join(' '))
  return words.length > 0 && words.every((word) => haystack.includes(word))
}

export default function IssueChatCard({ hotelId, user, search, issueId }) {
  const [issues, setIssues] = useState([])
  const [selectedId, setSelectedId] = useState(issueId ? String(issueId) : '')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const mayView = Boolean(user && canUser(user, 'issues', 'view'))
  useEffect(() => {
    if (!mayView || !hotelId) { setLoading(false); return }
    let alive = true
    setLoading(true); setNotice(''); setDraft(null)
    fetchIssues(hotelId).then(({ issues: rows, ok }) => {
      if (!alive) return
      setIssues(ok ? (rows || []).filter((issue) => issue.hotelId === hotelId && issueMatches(issue, search, issueId)).slice(0, 10) : [])
      if (!ok) setNotice('Impossibile verificare dati aggiornati. Riprova quando sei online.')
    }).catch(() => { if (alive) setNotice('Caricamento non riuscito.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [hotelId, issueId, search, mayView])
  if (!mayView) return <p role="status">Non hai il permesso di visualizzare le segnalazioni.</p>
  if (loading) return <p role="status">Carico le segnalazioni della struttura…</p>
  if (!issues.length) return <p role="status">{notice || 'Nessuna segnalazione verificata corrisponde alla richiesta.'}</p>
  const issue = issues.find((item) => String(item.id) === selectedId) || issues[0]
  const patch = draft || { urgency: issue.urgency || 'media', title: issue.title || '', status: issue.status || 'open', completionNote: '' }
  const canEdit = canUser(user, 'issues', 'edit')
  const canComplete = canUser(user, 'issues', 'complete')
  const changed = patch.urgency !== issue.urgency || patch.title !== issue.title || patch.status !== issue.status || (patch.status === 'done' && patch.completionNote.trim())
  const setField = (key, value) => { setDraft({ ...patch, [key]: value }); setNotice('') }
  const save = async () => {
    if (!changed || saving || !navigator.onLine) { setNotice('Per confermare occorre una connessione online.'); return }
    if (!canEdit && (patch.title !== issue.title || patch.urgency !== issue.urgency)) { setNotice('Permesso di modifica mancante.'); return }
    if (patch.status !== issue.status && (!canComplete || patch.status !== 'done')) { setNotice('Operazione sullo stato non autorizzata.'); return }
    if (!window.confirm('Confermare le modifiche alla segnalazione reale?')) return
    const changes = {}
    if (patch.urgency !== issue.urgency) changes.urgency = patch.urgency
    if (patch.title !== issue.title) changes.title = patch.title
    if (patch.status !== issue.status && patch.status === 'done') {
      changes.status = 'done'
      changes.completedBy = user.name
      changes.completedAt = Date.now()
      changes.completionNote = patch.completionNote.trim() || null
    }
    setSaving(true)
    try {
      await updateIssueRow(issue.id, { ...changes, hotelId })
      const verified = await fetchIssues(hotelId)
      if (!verified.ok) throw Error('La modifica è stata inviata, ma non è stato possibile verificare il risultato online.')
      setIssues((current) => current.map((item) => verified.issues.find((fresh) => String(fresh.id) === String(item.id)) || item))
      setDraft(null)
      setNotice('Aggiornamento salvato e verificato in RandApp.')
    } catch (error) { setNotice(error?.message || 'Salvataggio non verificato. Controlla RandApp prima di riprovare.') }
    finally { setSaving(false) }
  }
  return <section className="randai-issue-card" data-testid="randai-issue-card" aria-label="Dettaglio segnalazione interattivo">
    <strong>Segnalazione · {issue.room || 'Area non specificata'}</strong>
    {issues.length > 1 && <label>Risultato<select value={String(issue.id)} onChange={(event) => { setSelectedId(event.target.value); setDraft(null); setNotice('') }}>{issues.map((item) => <option key={item.id} value={String(item.id)}>{item.room || 'Area'} · {item.title}</option>)}</select></label>}
    <small>Hotel: {hotelId} · Ticket {issue.ticketCode || issue.ticketNumber || issue.id}</small>
    <label>Descrizione<input value={patch.title} disabled={!canEdit || saving} onChange={(event) => setField('title', event.target.value)} /></label>
    <div className="randai-issue-card__fields">
      <label>Priorità<select value={patch.urgency} disabled={!canEdit || saving} onChange={(event) => setField('urgency', event.target.value)}><option value="bassa">Bassa</option><option value="media">Media</option><option value="alta">Alta</option></select></label>
      <label>Stato<select value={patch.status} disabled={saving || !canComplete || issue.status === 'done'} onChange={(event) => setField('status', event.target.value)}><option value={issue.status}>{issue.status === 'done' ? 'Completata' : 'Attuale'}</option>{issue.status !== 'done' && <option value="done">Completata</option>}</select></label>
    </div>
    {patch.status === 'done' && issue.status !== 'done' && <label>Nota di completamento<textarea rows={2} value={patch.completionNote} onChange={(event) => setField('completionNote', event.target.value)} placeholder="Lavoro eseguito…" /></label>}
    <small>Assegnazione tecnici: utilizzare il flusso dedicato di RandApp.</small>
    {notice && <p role="status" className="randai-issue-card__notice">{notice}</p>}
    <button type="button" disabled={!changed || saving || !navigator.onLine} onClick={save}>{saving ? 'Verifica salvataggio…' : 'Conferma modifiche'}</button>
  </section>
}
