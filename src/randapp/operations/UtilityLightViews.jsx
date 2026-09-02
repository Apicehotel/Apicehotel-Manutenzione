import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchFeedback, insertFeedback, subscribeFeedback } from '../../feedback-data.js'
import { changeOwnPin, updateOwnProfile, setOwnPresence } from '../../auth-data.js'
import { canUser } from '../../permissions.js'
import { supabase } from '../../supabase.js'
import { Button, Card, EmptyState, Field, Icon, Sheet, TextInput } from '../ui.jsx'
import { PageTitle, fmt, whatsappLink } from './view-primitives.jsx'

const TECHNICIAN_MANAGER_ROLES = new Set(['Direzione', 'Direttore Centro Congressi', 'Reception', 'admin'])
const emptyTechnician = () => ({ id: null, name: '', phone: '', company: '', email: '', notes: '', active: true, competencyIds: [] })

function normalizeTechnicianPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) return `+${digits}`
  if (raw.startsWith('00')) return `+${digits.slice(2)}`
  if (/^3\d{9}$/.test(digits)) return `+39${digits}`
  if (/^39\d{10}$/.test(digits)) return `+${digits}`
  return raw
}

export function TechnicianDirectoryView({ user, hotel, createSignal = 0 }) {
  const [technicians, setTechnicians] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [links, setLinks] = useState([])
  const [draft, setDraft] = useState(emptyTechnician())
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const canManage = Boolean(user && (canUser(user, 'technicians', 'create') || canUser(user, 'technicians', 'manage') || TECHNICIAN_MANAGER_ROLES.has(user.role)))

  const load = useCallback(async () => {
    if (!supabase || !hotel?.id) return
    const [techRes, compRes, linkRes] = await Promise.all([
      supabase.from('external_technicians').select('id,hotel_id,name,phone,company,email,notes,active,updated_at').eq('hotel_id', hotel.id).order('name'),
      supabase.from('technician_competencies').select('id,code,label,active').eq('active', true).order('label'),
      supabase.from('external_technician_competencies').select('technician_id,competency_id'),
    ])
    const error = techRes.error || compRes.error || linkRes.error
    if (error) throw error
    setTechnicians(techRes.data || [])
    setCompetencies(compRes.data || [])
    setLinks(linkRes.data || [])
  }, [hotel?.id])

  useEffect(() => {
    load().catch((error) => setMessage(error?.message || 'Rubrica tecnici non disponibile'))
    if (!supabase || !hotel?.id) return undefined
    const channel = supabase.channel(`randapp-technicians-${hotel.id}`)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'external_technicians', filter: `hotel_id=eq.${hotel.id}` }, () => load().catch(() => {}))
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'external_technician_competencies' }, () => load().catch(() => {}))
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [hotel?.id, load])

  useEffect(() => {
    if (!createSignal || !canManage) return
    setDraft(emptyTechnician())
    setMessage('')
    setOpen(true)
  }, [createSignal, canManage])

  const competencyMap = useMemo(() => Object.fromEntries(competencies.map((item) => [item.id, item.label])), [competencies])
  const labelsFor = (technicianId) => links.filter((item) => item.technician_id === technicianId).map((item) => competencyMap[item.competency_id]).filter(Boolean)
  const toggleCompetency = (id) => setDraft((current) => ({ ...current, competencyIds: current.competencyIds.includes(id) ? current.competencyIds.filter((value) => value !== id) : [...current.competencyIds, id] }))
  const close = () => { if (!busy) { setOpen(false); setDraft(emptyTechnician()) } }
  const edit = (technician) => {
    if (!canManage) return
    setDraft({ ...technician, competencyIds: links.filter((item) => item.technician_id === technician.id).map((item) => item.competency_id) })
    setMessage('')
    setOpen(true)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!canManage || busy) return
    const name = draft.name.trim()
    const phone = normalizeTechnicianPhone(draft.phone)
    if (!name) { setMessage('Inserisci il nome del tecnico.'); return }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { setMessage('Inserisci un numero WhatsApp valido in formato internazionale, es. +393341196935.'); return }
    setBusy(true); setMessage('')
    try {
      const { data: technicianId, error } = await supabase.rpc('technician_manage_directory', {
        p_hotel_id: hotel.id,
        p_technician_id: draft.id || null,
        p_name: name,
        p_phone: phone,
        p_company: draft.company.trim() || null,
        p_email: draft.email.trim() || null,
        p_notes: draft.notes.trim() || null,
        p_active: Boolean(draft.active),
      })
      if (error) throw error
      const { error: competencyError } = await supabase.rpc('technician_set_competencies', {
        p_hotel_id: hotel.id,
        p_technician_id: technicianId,
        p_competency_ids: draft.competencyIds,
      })
      if (competencyError) throw competencyError
      setOpen(false)
      setDraft(emptyTechnician())
      setMessage('Tecnico salvato.')
      await load()
    } catch (error) {
      setMessage(error?.message || 'Salvataggio tecnico non riuscito')
    } finally { setBusy(false) }
  }

  return <div data-testid="technicians-view">
    <PageTitle title="Rubrica tecnici" subtitle={hotel.name}/>
    {message && <p className="rs-badge rs-badge--accent" style={{display:'inline-flex',margin:'0 0 12px'}}>{message}</p>}
    {!technicians.length ? <EmptyState icon="phone" title="Nessun tecnico esterno">{canManage ? 'Usa il pulsante + per aggiungere il primo tecnico.' : 'Non ci sono tecnici esterni registrati per questa struttura.'}</EmptyState> : <div className="rs-migrated-list">{technicians.map((tech) => {
      const wa = whatsappLink(tech.phone)
      const skillLabels = labelsFor(tech.id)
      return <Card className="rs-card--pad rs-tech-card" key={tech.id}>
        <div style={{minWidth:0}}><strong>{tech.name}</strong><small>{tech.company ? `${tech.company} · ` : ''}{tech.phone || 'Numero non inserito'}{tech.active ? '' : ' · Disattivato'}</small>{skillLabels.length > 0 && <small>{skillLabels.join(' · ')}</small>}</div>
        <div className="rs-op-card__actions">{wa && tech.active && <a className="rs-btn rs-btn--outline rs-btn--sm" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="message"/><span>WhatsApp</span></a>}{canManage && <Button type="button" variant="ghost" size="sm" icon="edit" onClick={() => edit(tech)}>Modifica</Button>}</div>
      </Card>
    })}</div>}

    <Sheet open={open} onClose={close} title={draft.id ? 'Modifica tecnico' : 'Nuovo tecnico'}>
      <form className="rs-migrated-form" onSubmit={save} data-testid="technician-form">
        <Field label="Nome tecnico"><TextInput value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Es. Tecnico ascensori" autoFocus /></Field>
        <Field label="WhatsApp"><TextInput value={draft.phone} inputMode="tel" onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="+39 334 119 6935" /></Field>
        <Field label="Ditta"><TextInput value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} placeholder="Facoltativa" /></Field>
        <Field label="Email"><TextInput type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Facoltativa" /></Field>
        <fieldset className="rs-fieldset"><legend>Competenze</legend><div className="rs-chips">{competencies.map((item) => <button type="button" key={item.id} className={`rs-chip ${draft.competencyIds.includes(item.id) ? 'active' : ''}`} onClick={() => toggleCompetency(item.id)}>{draft.competencyIds.includes(item.id) ? '✓ ' : ''}{item.label}</button>)}</div>{!competencies.length && <small className="rs-field__hint">Nessuna competenza configurata.</small>}</fieldset>
        <Field label="Note"><textarea className="rs-textarea" rows="4" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Disponibilità, riferimenti, indicazioni…" /></Field>
        <label className="rs-chip active" style={{width:'fit-content'}}><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /> Tecnico attivo</label>
        {message && <p className="rs-error">{message}</p>}
        <div className="rs-form-actions"><Button type="button" variant="ghost" onClick={close} disabled={busy}>Annulla</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Salvo…' : 'Salva tecnico'}</Button></div>
      </form>
    </Sheet>
  </div>
}

export function FeedbackView({hotel,user,received=false}){
  const[items,setItems]=useState([]),[text,setText]=useState(''),[busy,setBusy]=useState(false)
  const load=useCallback(async()=>{if(!received)return;const result=await fetchFeedback(hotel.id);setItems(result.items||[])},[hotel.id,received])
  useEffect(()=>{if(!received)return undefined;load();return subscribeFeedback(hotel.id,load)},[hotel.id,received,load])
  const submit=async e=>{e.preventDefault();if(!text.trim())return;setBusy(true);try{await insertFeedback(hotel.id,user?.name||'Utente',text.trim());setText('')}finally{setBusy(false)}}
  if(received)return <div data-testid="feedback-received-view"><PageTitle title="Feedback ricevuti" subtitle={hotel.name}/>{!items.length?<EmptyState icon="message" title="Nessun feedback">Non sono ancora arrivati messaggi.</EmptyState>:<div className="rs-migrated-list">{items.map(item=><Card key={item.id} className="rs-card--pad rs-op-card"><div className="rs-op-card__head"><strong>{item.userName||'Utente'}</strong><small>{fmt(item.createdAt)}</small></div><p>{item.text}</p></Card>)}</div>}</div>
  return <div data-testid="feedback-view"><PageTitle title="Invia feedback" subtitle="Suggerimenti sull'app"/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={submit}><Field label="Messaggio"><textarea className="rs-textarea" rows="6" value={text} onChange={e=>setText(e.target.value)} placeholder="Scrivi qui il tuo suggerimento…"/></Field><Button type="submit" disabled={busy||!text.trim()}>{busy?'Invio…':'Invia feedback'}</Button></form></Card></div>
}

export function PinView(){
  const[currentPin,setCurrentPin]=useState(''),[newPin,setNewPin]=useState(''),[confirmPin,setConfirmPin]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const submit=async e=>{e.preventDefault();setMessage('');setError('');if(newPin.length!==4||newPin!==confirmPin)return setError('Il nuovo PIN deve essere di 4 cifre e coincidere.');setBusy(true);try{await changeOwnPin({currentPin,newPin});setCurrentPin('');setNewPin('');setConfirmPin('');setMessage('PIN aggiornato correttamente.')}catch(err){setError(err?.message||'Cambio PIN non riuscito')}finally{setBusy(false)}}
  const pinProps=(value,setter)=>({value,inputMode:'numeric',autoComplete:'off',onChange:e=>setter(e.target.value.replace(/\D/g,'').slice(0,4))})
  return <div data-testid="pin-view"><PageTitle title="Cambia PIN" subtitle="Proteggi il tuo account"/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={submit}><Field label="PIN attuale"><TextInput icon="lock" {...pinProps(currentPin,setCurrentPin)}/></Field><Field label="Nuovo PIN"><TextInput icon="lock" {...pinProps(newPin,setNewPin)}/></Field><Field label="Ripeti nuovo PIN"><TextInput icon="lock" {...pinProps(confirmPin,setConfirmPin)}/></Field>{error&&<p className="rs-error">{error}</p>}{message&&<p className="rs-success">{message}</p>}<Button type="submit" disabled={busy||currentPin.length!==4||newPin.length!==4||confirmPin.length!==4}>{busy?'Salvo…':'Aggiorna PIN'}</Button></form></Card></div>
}

export function ProfileDetailsView({user,hotel}){
  const[email,setEmail]=useState(user?.email||''),[phone,setPhone]=useState(user?.phone||''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{setEmail(user?.email||'');setPhone(user?.phone||'')},[user])
  const save=async e=>{e.preventDefault();setBusy(true);setMessage('');try{await updateOwnProfile({email,phone});setMessage('Profilo aggiornato.')}catch(err){setMessage(err?.message||'Aggiornamento non riuscito')}finally{setBusy(false)}}
  const presence=async value=>{setBusy(true);try{await setOwnPresence(value);setMessage(value?'Presenza attivata.':'Presenza disattivata.')}finally{setBusy(false)}}
  return <div data-testid="profile-details-view"><PageTitle title="Dati profilo" subtitle={hotel.name}/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={save}><Field label="Email"><TextInput value={email} type="email" onChange={e=>setEmail(e.target.value)}/></Field><Field label="Telefono"><TextInput value={phone} inputMode="tel" onChange={e=>setPhone(e.target.value)}/></Field><div className="rs-op-card__actions"><Button type="submit" disabled={busy}>Salva</Button><Button type="button" variant="outline" onClick={()=>presence(true)}>Sono in struttura</Button><Button type="button" variant="ghost" onClick={()=>presence(false)}>Fuori struttura</Button></div>{message&&<p className="rs-muted">{message}</p>}</form></Card></div>
}

export function ManualView(){return <div data-testid="manual-view"><PageTitle title="Manuale" subtitle="Guida rapida RandApp"/><div className="rs-migrated-list">{[['Segnalazioni','Il pulsante + è contestuale: in Segnalazioni crea direttamente una nuova segnalazione.'],['Interventi','Consulta i lavori assegnati e aggiorna lo stato quando il lavoro è completato.'],['Avvisi urgenti','Gli avvisi urgenti sono sincronizzati in tempo reale e possono essere presi in carico.'],['Planning','Nel Planning il + propone solo le nuove attività compatibili con i tuoi permessi.'],['Rubrica tecnici','In Rubrica tecnici il + apre direttamente Nuovo tecnico e salva nell’anagrafica tecnici esterni.'],['Struttura','Tocca il nome dell’hotel nell’intestazione per cambiare struttura quando il tuo account ne gestisce più di una.'],['Aspetto','Tema Sistema/Chiaro/Scuro e dimensione Piccolo/Normale/Grande sono disponibili in Profilo e nel menu.']].map(([title,text])=><Card key={title} className="rs-card--pad rs-manual-card"><strong>{title}</strong><p>{text}</p></Card>)}</div></div>}
