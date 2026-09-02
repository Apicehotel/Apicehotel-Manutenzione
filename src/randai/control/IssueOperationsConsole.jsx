import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { HOTELS } from '../../config.js'
import { createIssueContextEnvelope, publishRandAIContext } from '../context/envelope.js'
import { executeRandAIAction, prepareRandAIAction, rejectRandAIAction } from '../action-gateway.js'
import './issue-operations-console.css'

const HOTEL_LABELS = Object.fromEntries(HOTELS.map((hotel) => [hotel.id, hotel.name]))
const normalize = (value) => String(value || '').trim().toLowerCase()
const fmt = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const statusLabel = (value) => ({ done: 'Risolta', pending: 'Da fare', in_corso: 'In corso', progress: 'In corso', waiting: 'Attesa ricambio', tecnico: 'Tecnico' }[value] || value || '—')
const words = (value) => new Set(normalize(value).replace(/[^a-z0-9à-ÿ]+/gi, ' ').split(/\s+/).filter((word) => word.length >= 3))
const overlap = (a, b) => {
  const left = words(a), right = words(b)
  let score = 0
  for (const token of left) if (right.has(token)) score += 1
  return score
}

function Badge({ children, tone = '' }) { return <span className={`ioc-badge ${tone}`}>{children}</span> }
function Empty({ children }) { return <div className="ioc-empty">{children}</div> }

function sourceTone(origin) { return normalize(origin) === 'whatsapp' ? 'whatsapp' : '' }
function urgencyTone(value) {
  const level = normalize(value)
  if (['urgente', 'alta'].includes(level)) return 'bad'
  if (level === 'media') return 'warn'
  return 'good'
}

function similarScore(issue, candidate) {
  if (!issue || !candidate || issue.hotelId !== candidate.hotelId || issue.id === candidate.id) return -1
  let score = 0
  if (normalize(issue.category) && normalize(issue.category) === normalize(candidate.category)) score += 4
  if (normalize(issue.room) && normalize(issue.room) === normalize(candidate.room)) score += 3
  score += Math.min(3, overlap(`${issue.title} ${issue.category}`, `${candidate.title} ${candidate.category}`))
  if (normalize(candidate.status) === 'done') score += 1
  return score
}

function procedureScore(issue, procedure) {
  if (!issue || !procedure || issue.hotelId !== procedure.hotel_id || procedure.status !== 'approved') return -1
  let score = 0
  if (normalize(issue.category) && normalize(issue.category) === normalize(procedure.category)) score += 5
  score += Math.min(4, overlap(`${issue.title} ${issue.category} ${issue.room}`, `${procedure.title} ${procedure.summary} ${procedure.symptom} ${procedure.area} ${procedure.category}`))
  return score
}

function equipmentScore(issue, equipment) {
  if (!issue || !equipment || issue.hotelId !== equipment.hotel_id || equipment.active === false) return -1
  let score = 0
  if (normalize(issue.room) && normalize(equipment.location).includes(normalize(issue.room))) score += 4
  if (normalize(issue.category) && normalize(equipment.category) === normalize(issue.category)) score += 3
  score += Math.min(3, overlap(`${issue.title} ${issue.category} ${issue.room}`, `${equipment.name} ${equipment.category} ${equipment.location}`))
  return score
}

function buildTimeline(issue, whatsappRows) {
  if (!issue) return []
  const events = []
  for (const message of whatsappRows) {
    events.push({ id: `wa-${message.id}`, time: message.received_at, title: 'Messaggio WhatsApp ricevuto', detail: message.body || 'Messaggio con allegato', tone: 'whatsapp' })
    if (message.processed_at && message.processing_status) events.push({ id: `wa-process-${message.id}`, time: message.processed_at, title: `WhatsApp · ${message.processing_status}`, detail: message.reply_text || 'Messaggio elaborato e collegato alla segnalazione.' })
  }
  if (issue.createdAt) events.push({ id: `created-${issue.id}`, time: issue.createdAt, title: 'Segnalazione creata', detail: `${issue.createdByName || issue.origin || 'Sistema'} · ${issue.room || 'zona non indicata'}` })
  if (issue.technicianAskedAt || issue.technicianAskedBy) events.push({ id: `tech-asked-${issue.id}`, time: issue.technicianAskedAt || issue.updatedAt, title: 'Tecnico richiesto', detail: [issue.technicianAskedBy, issue.technicianNote].filter(Boolean).join(' · ') || 'Richiesta tecnico registrata.' })
  if (issue.technicianExpectedArrival) events.push({ id: `tech-arrival-${issue.id}`, time: issue.technicianExpectedArrival, title: 'Arrivo tecnico previsto', detail: issue.technicianName || 'Tecnico esterno' })
  if (normalize(issue.status) === 'waiting' || issue.pieceName) events.push({ id: `part-${issue.id}`, time: issue.updatedAt || issue.createdAt, title: 'Ricambio / materiale', detail: issue.pieceName ? `In attesa: ${issue.pieceName}` : 'Segnalazione in attesa ricambio.' })
  if (issue.completedAt) events.push({ id: `done-${issue.id}`, time: issue.completedAt, title: 'Segnalazione risolta', detail: [issue.completedBy, issue.completionNote].filter(Boolean).join(' · ') || 'Completamento registrato.', tone: 'good' })
  return events.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0))
}

function buildContextAnalysis(issue, similar, procedures, equipment) {
  if (!issue) return { facts: [], next: 'Seleziona una segnalazione.' }
  const facts = []
  if (['urgente', 'alta'].includes(normalize(issue.urgency))) facts.push('La segnalazione è già ad alta priorità.')
  if (normalize(issue.origin) === 'whatsapp') facts.push('La segnalazione proviene da WhatsApp ed è stata unificata con RandApp.')
  if (issue.technicianAskedBy || issue.technicianRequestedBy || normalize(issue.status) === 'tecnico') facts.push('È presente una richiesta o assegnazione tecnico.')
  if (normalize(issue.status) === 'waiting' || issue.pieceName) facts.push(`È in attesa di ricambio${issue.pieceName ? `: ${issue.pieceName}` : ''}.`)
  if (similar.length) facts.push(`Trovati ${similar.length} casi simili nella stessa struttura.`)
  if (procedures.length) facts.push(`Trovate ${procedures.length} procedure approvate pertinenti.`)
  if (equipment.length) facts.push(`Trovati ${equipment.length} possibili impianti correlati.`)
  if (!facts.length) facts.push('Nessuna evidenza aggiuntiva verificabile oltre ai dati della segnalazione.')

  let next = 'Verifica sul posto e raccogli dati prima di modificare lo stato.'
  if (normalize(issue.status) === 'done') next = 'Nessuna azione operativa: la segnalazione risulta risolta.'
  else if (normalize(issue.status) === 'waiting' || issue.pieceName) next = 'Verifica disponibilità del ricambio e aggiorna l’intervento quando disponibile.'
  else if (issue.technicianAskedBy || issue.technicianRequestedBy || normalize(issue.status) === 'tecnico') next = 'Segui autorizzazione, assegnazione e arrivo del tecnico senza chiudere anticipatamente.'
  else if (procedures.length) next = `Apri la procedura approvata più pertinente: “${procedures[0].title}”.`
  else if (similar.length) next = 'Confronta i casi simili risolti, senza assumere che la causa sia la stessa.'
  return { facts, next }
}

function ActionGatewayPanel({ issue, onRefresh }) {
  const [priority, setPriority] = useState(normalize(issue?.urgency) || 'media')
  const [partName, setPartName] = useState(issue?.pieceName || '')
  const [completionNote, setCompletionNote] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setPriority(['alta', 'media', 'bassa'].includes(normalize(issue?.urgency)) ? normalize(issue.urgency) : 'media')
    setPartName(issue?.pieceName || '')
    setCompletionNote('')
    setPending(null)
    setNotice('')
  }, [issue?.id])

  const prepare = async (type, input = {}) => {
    if (!issue) return
    setBusy(true); setNotice('')
    try {
      const context = createIssueContextEnvelope({ hotelId: issue.hotelId, issue })
      publishRandAIContext(context)
      const result = await prepareRandAIAction({ hotelId: issue.hotelId, type, resourceId: issue.id, input, context })
      setPending(result.plan || null)
    } catch (error) {
      setNotice(error?.message || 'Preparazione azione non riuscita.')
    } finally { setBusy(false) }
  }

  const execute = async () => {
    if (!pending?.approval_id) return
    setBusy(true); setNotice('')
    try {
      await executeRandAIAction({ hotelId: issue.hotelId, approvalId: pending.approval_id })
      setPending(null)
      setNotice('Azione eseguita e verificata dal RandAI Action Gateway.')
      await onRefresh?.()
    } catch (error) {
      setNotice(error?.message || 'Esecuzione azione non riuscita.')
    } finally { setBusy(false) }
  }

  const reject = async () => {
    if (!pending?.approval_id) { setPending(null); return }
    setBusy(true)
    try { await rejectRandAIAction({ hotelId: issue.hotelId, approvalId: pending.approval_id }) }
    catch (error) { setNotice(error?.message || 'Annullamento non riuscito.') }
    finally { setPending(null); setBusy(false) }
  }

  if (!issue) return null
  return <section className="ioc-section">
    <div className="ioc-section-head"><div><small>AZIONI CONTROLLATE</small><h3>RandAI Action Gateway</h3></div><Badge tone="secure">conferma obbligatoria</Badge></div>
    <p className="ioc-muted">Nessuna modifica viene scritta direttamente dalla console. Il Gateway verifica hotel, permessi, stato corrente, idempotenza e risultato.</p>
    <div className="ioc-actions-grid">
      <div className="ioc-action-card"><label>Priorità<select value={priority} onChange={(event) => setPriority(event.target.value)} disabled={busy || normalize(issue.status) === 'done'}><option value="alta">Alta</option><option value="media">Media</option><option value="bassa">Bassa</option></select></label><button onClick={() => prepare('issue.update_priority', { priority })} disabled={busy || normalize(issue.status) === 'done'}>Proponi priorità</button></div>
      <div className="ioc-action-card"><label>Ricambio<input value={partName} onChange={(event) => setPartName(event.target.value)} placeholder="Nome ricambio" disabled={busy || normalize(issue.status) === 'done'} /></label><button onClick={() => prepare('issue.set_waiting_part', { part_name: partName.trim() })} disabled={busy || !partName.trim() || normalize(issue.status) === 'done'}>Metti in attesa ricambio</button></div>
      <div className="ioc-action-card"><label>Nota chiusura<textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} placeholder="Facoltativa" rows={2} disabled={busy || normalize(issue.status) === 'done'} /></label><button className="danger" onClick={() => prepare('issue.mark_done', { completion_note: completionNote.trim() || null })} disabled={busy || normalize(issue.status) === 'done'}>Proponi risoluzione</button></div>
    </div>
    {pending && <div className="ioc-approval"><div><small>ANTEPRIMA DA CONFERMARE</small><strong>{pending.summary}</strong><p>Rischio {pending.risk} · scadenza {fmt(pending.expires_at)}</p></div><div><button onClick={reject} disabled={busy}>Annulla</button><button className="primary" onClick={execute} disabled={busy}>Conferma ed esegui</button></div></div>}
    {notice && <div className="ioc-notice">{notice}</div>}
  </section>
}

export default function IssueOperationsConsole({ issues = [], allIssues = [], procedures = [], equipment = [], documents = [], hotelFilter = 'all', onRefresh }) {
  const [selectedId, setSelectedId] = useState(null)
  const [whatsappRows, setWhatsappRows] = useState([])
  const [waBusy, setWaBusy] = useState(false)
  const [waError, setWaError] = useState('')
  const selected = useMemo(() => issues.find((item) => item.id === selectedId) || (selectedId ? allIssues.find((item) => item.id === selectedId) : null) || issues[0] || null, [issues, allIssues, selectedId])

  useEffect(() => {
    if (!selectedId && issues[0]?.id) setSelectedId(issues[0].id)
    else if (selectedId && !allIssues.some((item) => item.id === selectedId) && issues[0]?.id) setSelectedId(issues[0].id)
  }, [issues, allIssues, selectedId])

  const loadWhatsapp = useCallback(async () => {
    if (!supabase || !selected?.id || !selected?.hotelId) { setWhatsappRows([]); return }
    setWaBusy(true); setWaError('')
    const { data, error } = await supabase.from('whatsapp_inbound_messages').select('id,message_sid,hotel_id,body,num_media,media_content_type,media_storage_path,processing_status,issue_id,reply_text,received_at,processed_at').eq('hotel_id', selected.hotelId).eq('issue_id', selected.id).order('received_at', { ascending: true })
    if (error) { setWaError(error.message || 'Cronologia WhatsApp non disponibile'); setWhatsappRows([]) }
    else setWhatsappRows(data || [])
    setWaBusy(false)
  }, [selected?.id, selected?.hotelId])

  useEffect(() => { loadWhatsapp() }, [loadWhatsapp])
  useEffect(() => {
    if (!supabase || !selected?.hotelId) return
    const channel = supabase.channel(`randai-issue-whatsapp-${selected.hotelId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_inbound_messages', filter: `hotel_id=eq.${selected.hotelId}` }, (payload) => {
      if (payload.new?.issue_id === selected.id || payload.old?.issue_id === selected.id) loadWhatsapp()
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selected?.id, selected?.hotelId, loadWhatsapp])

  useEffect(() => {
    if (!selected) return
    publishRandAIContext(createIssueContextEnvelope({ hotelId: selected.hotelId, issue: selected }))
  }, [selected?.id, selected?.hotelId, selected?.status, selected?.urgency, selected?.updatedAt])

  const similar = useMemo(() => selected ? allIssues.map((item) => ({ item, score: similarScore(selected, item) })).filter((entry) => entry.score >= 4).sort((a, b) => b.score - a.score || (b.item.completedAt || b.item.updatedAt || 0) - (a.item.completedAt || a.item.updatedAt || 0)).slice(0, 6).map((entry) => entry.item) : [], [selected, allIssues])
  const matchedProcedures = useMemo(() => selected ? procedures.map((item) => ({ item, score: procedureScore(selected, item) })).filter((entry) => entry.score >= 2).sort((a, b) => b.score - a.score).slice(0, 5).map((entry) => entry.item) : [], [selected, procedures])
  const matchedEquipment = useMemo(() => selected ? equipment.map((item) => ({ item, score: equipmentScore(selected, item) })).filter((entry) => entry.score >= 2).sort((a, b) => b.score - a.score).slice(0, 5).map((entry) => entry.item) : [], [selected, equipment])
  const relatedDocs = useMemo(() => {
    const procedureIds = new Set(matchedProcedures.map((item) => item.id))
    const equipmentIds = new Set(matchedEquipment.map((item) => item.id))
    return documents.filter((item) => item.hotel_id === selected?.hotelId && (procedureIds.has(item.procedure_id) || equipmentIds.has(item.equipment_id))).slice(0, 8)
  }, [documents, matchedProcedures, matchedEquipment, selected?.hotelId])
  const timeline = useMemo(() => buildTimeline(selected, whatsappRows), [selected, whatsappRows])
  const analysis = useMemo(() => buildContextAnalysis(selected, similar, matchedProcedures, matchedEquipment), [selected, similar, matchedProcedures, matchedEquipment])

  const scopedOpen = issues.filter((item) => normalize(item.status) !== 'done').length
  const scopedHigh = issues.filter((item) => normalize(item.status) !== 'done' && ['urgente', 'alta'].includes(normalize(item.urgency))).length
  const scopedWhatsapp = issues.filter((item) => normalize(item.origin) === 'whatsapp').length
  const scopedWaiting = issues.filter((item) => normalize(item.status) === 'waiting' || item.pieceName).length

  return <div className="ioc-shell">
    <div className="ioc-kpis"><div><span>Aperte</span><strong>{scopedOpen}</strong></div><div><span>Alta priorità</span><strong>{scopedHigh}</strong></div><div><span>Da WhatsApp</span><strong>{scopedWhatsapp}</strong></div><div><span>Attesa ricambio</span><strong>{scopedWaiting}</strong></div></div>
    <div className="ioc-layout">
      <section className="ioc-list-panel">
        <header><div><small>CODA OPERATIVA</small><h2>Segnalazioni</h2></div><Badge>{issues.length} risultati</Badge></header>
        <div className="ioc-list">{issues.map((item) => <button key={item.id} className={`ioc-issue ${selected?.id === item.id ? 'active' : ''}`} onClick={() => setSelectedId(item.id)}><div className="ioc-issue-top"><span>{HOTEL_LABELS[item.hotelId] || item.hotelId} · {item.room || '—'}</span><Badge tone={sourceTone(item.origin)}>{item.origin || 'App'}</Badge></div><strong>{item.title || item.category || 'Segnalazione'}</strong><small>{item.category || 'Senza categoria'} · {statusLabel(item.status)}</small><div className="ioc-issue-foot"><Badge tone={urgencyTone(item.urgency)}>{item.urgency || '—'}</Badge><time>{fmt(item.createdAt)}</time></div></button>)}{!issues.length && <Empty>Nessuna segnalazione con i filtri correnti.</Empty>}</div>
      </section>

      <section className="ioc-workspace">
        {!selected ? <Empty>Seleziona una segnalazione per aprire lo spazio operativo.</Empty> : <>
          <header className="ioc-workspace-head"><div><div className="ioc-eyebrow"><span>{HOTEL_LABELS[selected.hotelId] || selected.hotelId}</span><Badge tone={sourceTone(selected.origin)}>{selected.origin || 'App'}</Badge><Badge tone={urgencyTone(selected.urgency)}>{selected.urgency || '—'}</Badge></div><h2>{selected.title || selected.category || 'Segnalazione'}</h2><p>{selected.room || 'Zona non indicata'} · {statusLabel(selected.status)} · {selected.department || 'reparto non indicato'}</p></div><button onClick={() => onRefresh?.()}>Aggiorna</button></header>

          <div className="ioc-facts"><div><span>Camera / zona</span><strong>{selected.room || '—'}</strong></div><div><span>Categoria</span><strong>{selected.category || '—'}</strong></div><div><span>Creata da</span><strong>{selected.createdByName || selected.origin || '—'}</strong></div><div><span>Data</span><strong>{fmt(selected.createdAt)}</strong></div><div><span>Tecnico</span><strong>{selected.technicianName || selected.technicianAskedBy || '—'}</strong></div><div><span>Ricambio</span><strong>{selected.pieceName || '—'}</strong></div></div>

          {(selected.photoData || selected.completionPhotoData) && <div className="ioc-photos">{selected.photoData && <figure><img src={selected.photoData} alt="Foto iniziale segnalazione"/><figcaption>Foto iniziale</figcaption></figure>}{selected.completionPhotoData && <figure><img src={selected.completionPhotoData} alt="Foto completamento"/><figcaption>Foto completamento</figcaption></figure>}</div>}

          <section className="ioc-section ioc-analysis"><div className="ioc-section-head"><div><small>ANALISI CONTESTUALE</small><h3>RandAI · evidenze verificabili</h3></div><Badge tone="secure">no diagnosi inventate</Badge></div><ul>{analysis.facts.map((fact, index) => <li key={`${fact}-${index}`}>{fact}</li>)}</ul><div className="ioc-next"><span>Prossima azione consigliata</span><strong>{analysis.next}</strong></div></section>

          <div className="ioc-two-col">
            <section className="ioc-section"><div className="ioc-section-head"><div><small>STORICO</small><h3>Casi simili</h3></div><Badge>{similar.length}</Badge></div>{similar.length ? <div className="ioc-mini-list">{similar.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)}><strong>{item.title || item.category}</strong><span>{item.room || '—'} · {statusLabel(item.status)} · {fmt(item.completedAt || item.updatedAt)}</span></button>)}</div> : <Empty>Nessun caso abbastanza simile nella stessa struttura.</Empty>}</section>
            <section className="ioc-section"><div className="ioc-section-head"><div><small>KNOWLEDGE</small><h3>Procedure approvate</h3></div><Badge>{matchedProcedures.length}</Badge></div>{matchedProcedures.length ? <div className="ioc-mini-list">{matchedProcedures.map((item) => <div key={item.id}><strong>{item.title}</strong><span>{item.summary || item.category || 'Procedura approvata'}</span></div>)}</div> : <Empty>Nessuna procedura approvata pertinente. RandAI non ne inventa una.</Empty>}</section>
          </div>

          <div className="ioc-two-col">
            <section className="ioc-section"><div className="ioc-section-head"><div><small>CONTESTO TECNICO</small><h3>Possibili impianti correlati</h3></div><Badge>{matchedEquipment.length}</Badge></div>{matchedEquipment.length ? <div className="ioc-mini-list">{matchedEquipment.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.category || 'Impianto'} · {item.location || 'posizione non indicata'}</span></div>)}</div> : <Empty>Nessun impianto correlabile con sufficiente evidenza.</Empty>}</section>
            <section className="ioc-section"><div className="ioc-section-head"><div><small>FONTI</small><h3>Documenti collegati</h3></div><Badge>{relatedDocs.length}</Badge></div>{relatedDocs.length ? <div className="ioc-mini-list">{relatedDocs.map((item) => <div key={item.id}><strong>{item.title || item.source_label || 'Documento'}</strong><span>{item.source_type || 'fonte'} · {item.media_kind || 'documento'}</span>{item.external_url && <a href={item.external_url} target="_blank" rel="noreferrer">Apri fonte ↗</a>}</div>)}</div> : <Empty>Nessun documento direttamente collegato alle corrispondenze.</Empty>}</section>
          </div>

          <section className="ioc-section"><div className="ioc-section-head"><div><small>TIMELINE UNIFICATA</small><h3>Storia della segnalazione</h3></div>{waBusy ? <Badge>WhatsApp…</Badge> : <Badge tone={waError ? 'warn' : ''}>{timeline.length} eventi</Badge>}</div>{waError && <div className="ioc-notice">WhatsApp: {waError}. La timeline RandApp resta disponibile.</div>}<div className="ioc-timeline">{timeline.map((event) => <div key={event.id} className={`ioc-event ${event.tone || ''}`}><span className="ioc-event-dot"/><div><time>{fmt(event.time)}</time><strong>{event.title}</strong><p>{event.detail}</p></div></div>)}{!timeline.length && <Empty>Nessun evento disponibile.</Empty>}</div></section>

          <ActionGatewayPanel issue={selected} onRefresh={onRefresh} />
        </>}
      </section>
    </div>
    <div className="ioc-scope-note">Ambito: {hotelFilter === 'all' ? 'tutte le strutture autorizzate' : (HOTEL_LABELS[hotelFilter] || hotelFilter)}. Casi simili, procedure, impianti e WhatsApp non vengono mai incrociati tra hotel diversi.</div>
  </div>
}
