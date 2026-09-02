import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import './technician-operations-console.css'

const AUTHORITY_ROLES = new Set(['direzione', 'direttore centro congressi', 'reception'])
const REQUEST_ROLES = new Set(['manutentore', 'direzione', 'direttore centro congressi', 'reception', 'admin'])
const normalizeRole = (value) => String(value || '').trim().toLowerCase()
const fmt = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const STATUS = {
  requested: 'Da autorizzare', authorized: 'Autorizzata', dispatched: 'Inviata al tecnico', in_progress: 'Tecnico al lavoro',
  awaiting_internal_close: 'Attende chiusura interna', closed: 'Chiusa', rejected: 'Rifiutata', cancelled: 'Annullata', expired: 'Scaduta',
}

function issueLabel(issue) {
  return `${issue.room || 'Zona non indicata'} · ${issue.title || issue.category || 'Segnalazione'}`
}

export default function TechnicianOperationsConsole({ accessHotels = [], hotelFilter = 'all', issues = [], onRefresh }) {
  const [tab, setTab] = useState('requests')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [memberships, setMemberships] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [links, setLinks] = useState([])
  const [requests, setRequests] = useState([])
  const [events, setEvents] = useState([])
  const [selectedHotel, setSelectedHotel] = useState(hotelFilter !== 'all' ? hotelFilter : (accessHotels[0] || ''))
  const [techDraft, setTechDraft] = useState({ id: null, name: '', phone: '', company: '', email: '', notes: '', active: true, competencyIds: [] })
  const [requestDraft, setRequestDraft] = useState({ issueId: '', reason: '' })
  const [authorizeTech, setAuthorizeTech] = useState({})
  const [lastAccess, setLastAccess] = useState(null)

  useEffect(() => { if (hotelFilter !== 'all') setSelectedHotel(hotelFilter) }, [hotelFilter])

  const load = useCallback(async () => {
    if (!supabase || !accessHotels.length) return
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return
    const [memberRes, techRes, compRes, linkRes, requestRes, eventRes] = await Promise.all([
      supabase.from('hotel_memberships').select('hotel_id,role,active').eq('auth_user_id', uid).eq('active', true).in('hotel_id', accessHotels),
      supabase.from('external_technicians').select('id,hotel_id,name,phone,company,email,notes,active,updated_at').in('hotel_id', accessHotels).order('name'),
      supabase.from('technician_competencies').select('id,code,label,active').eq('active', true).order('label'),
      supabase.from('external_technician_competencies').select('technician_id,competency_id'),
      supabase.from('technician_dispatch_requests').select('*').in('hotel_id', accessHotels).order('created_at', { ascending: false }),
      supabase.from('technician_intervention_events').select('*').in('hotel_id', accessHotels).order('created_at', { ascending: false }),
    ])
    const error = memberRes.error || techRes.error || compRes.error || linkRes.error || requestRes.error || eventRes.error
    if (error) throw error
    setMemberships(memberRes.data || [])
    setTechnicians(techRes.data || [])
    setCompetencies(compRes.data || [])
    setLinks(linkRes.data || [])
    setRequests(requestRes.data || [])
    setEvents(eventRes.data || [])
  }, [accessHotels.join('|')])

  useEffect(() => {
    load().catch((error) => setNotice(error?.message || 'Errore caricamento tecnici'))
    if (!supabase || !accessHotels.length) return
    const channel = supabase.channel(`randai-technicians-${accessHotels.join('-')}`)
    ;['external_technicians', 'external_technician_competencies', 'technician_dispatch_requests', 'technician_intervention_events'].forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => load().catch(() => {}))
    })
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, accessHotels.join('|')])

  const roles = useMemo(() => Object.fromEntries(memberships.map((m) => [m.hotel_id, m.role])), [memberships])
  const canAuthorize = (hotelId) => AUTHORITY_ROLES.has(normalizeRole(roles[hotelId]))
  const canRequest = (hotelId) => REQUEST_ROLES.has(normalizeRole(roles[hotelId]))
  const canManageDirectory = (hotelId) => canAuthorize(hotelId) || normalizeRole(roles[hotelId]) === 'admin'
  const scopedHotel = hotelFilter === 'all' ? null : hotelFilter
  const scopedTechnicians = technicians.filter((t) => !scopedHotel || t.hotel_id === scopedHotel)
  const scopedRequests = requests.filter((r) => !scopedHotel || r.hotel_id === scopedHotel)
  const openIssues = issues.filter((i) => String(i.status || '').toLowerCase() !== 'done' && (!selectedHotel || i.hotelId === selectedHotel))
  const competencyMap = useMemo(() => Object.fromEntries(competencies.map((c) => [c.id, c.label])), [competencies])
  const techCompetencies = (id) => links.filter((l) => l.technician_id === id).map((l) => competencyMap[l.competency_id]).filter(Boolean)
  const requestIssue = (id) => issues.find((issue) => issue.id === id)
  const requestTech = (id) => technicians.find((tech) => tech.id === id)

  const saveTechnician = async (event) => {
    event.preventDefault()
    if (!canManageDirectory(selectedHotel)) { setNotice('Solo Direzione, Centro Congressi, Reception o Admin possono gestire l’anagrafica tecnici.'); return }
    setBusy(true); setNotice('')
    try {
      const { data: id, error } = await supabase.rpc('technician_manage_directory', {
        p_hotel_id: selectedHotel, p_technician_id: techDraft.id || null, p_name: techDraft.name, p_phone: techDraft.phone,
        p_company: techDraft.company || null, p_email: techDraft.email || null, p_notes: techDraft.notes || null, p_active: techDraft.active,
      })
      if (error) throw error
      const { error: compError } = await supabase.rpc('technician_set_competencies', { p_hotel_id: selectedHotel, p_technician_id: id, p_competency_ids: techDraft.competencyIds })
      if (compError) throw compError
      setTechDraft({ id: null, name: '', phone: '', company: '', email: '', notes: '', active: true, competencyIds: [] })
      setNotice('Tecnico salvato.')
      await load()
    } catch (error) { setNotice(error?.message || 'Salvataggio non riuscito') } finally { setBusy(false) }
  }

  const editTechnician = (tech) => {
    setSelectedHotel(tech.hotel_id)
    setTechDraft({ ...tech, competencyIds: links.filter((l) => l.technician_id === tech.id).map((l) => l.competency_id) })
    setTab('directory')
  }

  const createRequest = async (event) => {
    event.preventDefault()
    if (!canRequest(selectedHotel)) { setNotice('Il tuo ruolo non può richiedere un tecnico per questa struttura.'); return }
    setBusy(true); setNotice('')
    try {
      const { error } = await supabase.rpc('technician_request_external', { p_hotel_id: selectedHotel, p_issue_id: requestDraft.issueId, p_reason: requestDraft.reason })
      if (error) throw error
      setRequestDraft({ issueId: '', reason: '' })
      setNotice('Richiesta tecnico creata. Ora deve essere autorizzata da Direzione, Centro Congressi o Reception.')
      await load(); await onRefresh?.()
    } catch (error) { setNotice(error?.message || 'Richiesta non riuscita') } finally { setBusy(false) }
  }

  const authorize = async (request) => {
    const technicianId = authorizeTech[request.id]
    if (!technicianId) { setNotice('Seleziona un tecnico prima di autorizzare.'); return }
    if (!canAuthorize(request.hotel_id)) { setNotice('Autorizzazione consentita solo a Direzione, Direttore Centro Congressi o Reception.'); return }
    setBusy(true); setNotice('')
    try {
      const { data, error } = await supabase.rpc('technician_authorize_external', { p_request_id: request.id, p_technician_id: technicianId, p_note: null, p_expires_hours: 72 })
      if (error) throw error
      const portalUrl = `${window.location.origin}/tecnico/${encodeURIComponent(data.token)}`
      const access = { requestId: request.id, token: data.token, url: portalUrl, technicianName: data.technician_name, expiresAt: data.expires_at }
      setLastAccess(access)
      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-tecnico-whatsapp', { body: { request_id: request.id, token: data.token } })
      if (sendError || sendData?.ok === false) {
        if (sendData?.error === 'template_not_approved' || !sendData) setNotice('Autorizzato e link sicuro creato. Il template WhatsApp “richiesta_tecnico_portale” deve ancora essere approvato: invio automatico bloccato in sicurezza.')
        else setNotice(`Autorizzato, ma WhatsApp non inviato: ${sendData?.error || sendError?.message || 'errore'}`)
      } else setNotice('Tecnico autorizzato e WhatsApp inviato.')
      await load(); await onRefresh?.()
    } catch (error) { setNotice(error?.message || 'Autorizzazione non riuscita') } finally { setBusy(false) }
  }

  const reject = async (request) => {
    if (!canAuthorize(request.hotel_id)) { setNotice('Solo Direzione, Centro Congressi o Reception possono rifiutare.'); return }
    const reason = window.prompt('Motivo del rifiuto')
    if (!reason?.trim()) return
    setBusy(true); setNotice('')
    try {
      const { error } = await supabase.rpc('technician_reject_external', { p_request_id: request.id, p_reason: reason.trim() })
      if (error) throw error
      setNotice('Richiesta rifiutata.'); await load()
    } catch (error) { setNotice(error?.message || 'Rifiuto non riuscito') } finally { setBusy(false) }
  }

  const copyLastLink = async () => {
    if (!lastAccess?.url) return
    await navigator.clipboard.writeText(lastAccess.url)
    setNotice('Link tecnico copiato. È una credenziale: condividilo solo con il tecnico autorizzato.')
  }

  return <div className="tc-shell">
    <div className="tc-head">
      <div><small>PUNTO 4 · CONTROLLO TECNICI ESTERNI</small><h2>Tecnici, autorizzazioni e interventi</h2><p>Richiesta → autorizzazione → link sicuro → intervento → chiusura interna.</p></div>
      <div className="tc-hotel"><label>Struttura<select value={selectedHotel} onChange={(e) => setSelectedHotel(e.target.value)}>{accessHotels.map((id) => <option key={id} value={id}>{id}</option>)}</select></label><span>Ruolo: <strong>{roles[selectedHotel] || '—'}</strong></span></div>
    </div>
    <nav className="tc-tabs" aria-label="Tecnici"><button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Richieste & autorizzazioni</button><button className={tab === 'directory' ? 'active' : ''} onClick={() => setTab('directory')}>Tecnici</button><button className={tab === 'interventions' ? 'active' : ''} onClick={() => setTab('interventions')}>Interventi</button></nav>
    {notice && <div className="tc-notice">{notice}</div>}
    {lastAccess && <section className="tc-secret"><div><strong>Link appena generato per {lastAccess.technicianName}</strong><small>Scade {fmt(lastAccess.expiresAt)} · non viene salvato in chiaro nel database.</small></div><button onClick={copyLastLink}>Copia link sicuro</button></section>}

    {tab === 'requests' && <div className="tc-grid">
      <section className="tc-card"><header><strong>Richiedi tecnico</strong><span>anche Manutenzione</span></header><form onSubmit={createRequest}><label>Segnalazione<select value={requestDraft.issueId} onChange={(e) => setRequestDraft((v) => ({ ...v, issueId: e.target.value }))} required><option value="">Seleziona…</option>{openIssues.map((issue) => <option key={issue.id} value={issue.id}>{issueLabel(issue)}</option>)}</select></label><label>Motivo<textarea rows="3" value={requestDraft.reason} onChange={(e) => setRequestDraft((v) => ({ ...v, reason: e.target.value }))} placeholder="Perché serve un tecnico esterno" required /></label><button disabled={busy || !canRequest(selectedHotel)}>Crea richiesta</button></form><small>L’autorizzazione finale non è concessa a Manutenzione o Admin.</small></section>
      <section className="tc-card tc-wide"><header><strong>Coda autorizzazioni</strong><span>{scopedRequests.length}</span></header><div className="tc-stack">{scopedRequests.map((request) => { const issue = requestIssue(request.issue_id); const tech = requestTech(request.technician_id); const candidates = technicians.filter((t) => t.hotel_id === request.hotel_id && t.active); return <article className="tc-request" key={request.id}><div className="tc-request-top"><div><strong>{issueLabel(issue || {})}</strong><small>{request.hotel_id} · richiesta da {request.requested_by_name || request.requested_by_role || '—'} · {fmt(request.requested_at)}</small></div><span data-status={request.status}>{STATUS[request.status] || request.status}</span></div><p>{request.reason}</p>{request.status === 'requested' && <div className="tc-authorize"><select value={authorizeTech[request.id] || ''} onChange={(e) => setAuthorizeTech((v) => ({ ...v, [request.id]: e.target.value }))}><option value="">Tecnico…</option>{candidates.map((t) => <option key={t.id} value={t.id}>{t.name}{techCompetencies(t.id).length ? ` · ${techCompetencies(t.id).join(', ')}` : ''}</option>)}</select><button onClick={() => authorize(request)} disabled={busy || !canAuthorize(request.hotel_id)}>Autorizza + invia</button><button className="secondary" onClick={() => reject(request)} disabled={busy || !canAuthorize(request.hotel_id)}>Rifiuta</button></div>}{tech && <div className="tc-meta">Tecnico: <strong>{tech.name}</strong> · {tech.phone}</div>}{request.notification_status && <div className="tc-meta">WhatsApp: <strong>{request.notification_status}</strong>{request.notification_error ? ` · ${request.notification_error}` : ''}</div>}{request.status === 'awaiting_internal_close' && <div className="tc-warning">Il tecnico ha terminato. La segnalazione resta aperta: chiudila dalla scheda Segnalazioni tramite Action Gateway.</div>}</article> })}{!scopedRequests.length && <div className="tc-empty">Nessuna richiesta tecnico.</div>}</div></section>
    </div>}

    {tab === 'directory' && <div className="tc-grid">
      <section className="tc-card"><header><strong>{techDraft.id ? 'Modifica tecnico' : 'Nuovo tecnico'}</strong><span>{selectedHotel}</span></header><form onSubmit={saveTechnician}><label>Nome<input value={techDraft.name} onChange={(e) => setTechDraft((v) => ({ ...v, name: e.target.value }))} required /></label><label>Telefono<input value={techDraft.phone} onChange={(e) => setTechDraft((v) => ({ ...v, phone: e.target.value }))} placeholder="+39…" required /></label><label>Azienda<input value={techDraft.company || ''} onChange={(e) => setTechDraft((v) => ({ ...v, company: e.target.value }))} /></label><label>Email<input type="email" value={techDraft.email || ''} onChange={(e) => setTechDraft((v) => ({ ...v, email: e.target.value }))} /></label><fieldset><legend>Competenze</legend>{competencies.map((c) => <label className="tc-check" key={c.id}><input type="checkbox" checked={techDraft.competencyIds.includes(c.id)} onChange={(e) => setTechDraft((v) => ({ ...v, competencyIds: e.target.checked ? [...v.competencyIds, c.id] : v.competencyIds.filter((id) => id !== c.id) }))} />{c.label}</label>)}</fieldset><label>Note<textarea rows="2" value={techDraft.notes || ''} onChange={(e) => setTechDraft((v) => ({ ...v, notes: e.target.value }))} /></label><label className="tc-check"><input type="checkbox" checked={techDraft.active} onChange={(e) => setTechDraft((v) => ({ ...v, active: e.target.checked }))} />Attivo</label><button disabled={busy || !canManageDirectory(selectedHotel)}>Salva tecnico</button></form></section>
      <section className="tc-card tc-wide"><header><strong>Elenco tecnici</strong><span>{scopedTechnicians.length}</span></header><div className="tc-tech-list">{scopedTechnicians.map((tech) => <button className="tc-tech" key={tech.id} onClick={() => editTechnician(tech)}><span><strong>{tech.name}</strong><small>{tech.company || 'Tecnico esterno'} · {tech.phone}</small></span><span>{techCompetencies(tech.id).join(' · ') || 'Competenze da impostare'}</span><em>{tech.active ? 'Attivo' : 'Disattivato'}</em></button>)}</div></section>
    </div>}

    {tab === 'interventions' && <section className="tc-card"><header><strong>Timeline interventi esterni</strong><span>{events.length} eventi</span></header><div className="tc-stack">{events.filter((event) => !scopedHotel || event.hotel_id === scopedHotel).map((event) => { const request = requests.find((r) => r.id === event.request_id); const tech = requestTech(event.technician_id); const issue = requestIssue(event.issue_id); return <div className="tc-event" key={event.id}><time>{fmt(event.created_at)}</time><div><strong>{event.event_type.replaceAll('_', ' ')}</strong><small>{tech?.name || 'Tecnico'} · {issueLabel(issue || {})}</small>{event.note && <p>{event.note}</p>}{event.arrival_at && <p>Arrivo: {fmt(event.arrival_at)}</p>}</div><span>{event.actor_kind}</span></div> })}{!events.length && <div className="tc-empty">Nessun evento tecnico.</div>}</div></section>}
  </div>
}
