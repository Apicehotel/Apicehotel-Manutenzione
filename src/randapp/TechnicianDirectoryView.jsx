import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { Button, EmptyState, Field, Icon, Sheet, TextInput } from './ui.jsx'
import { canManageTechnicianDirectory } from './technician-directory-policy.js'
import { Grid, PageTitle, Stack, Surface } from './randui/visual-primitives.jsx'
import { whatsappLink } from './operations/view-primitives.jsx'
import './technician-directory.css'

const emptyTechnician = () => ({ id:null,name:'',phone:'',company:'',email:'',notes:'',active:true,competencyIds:[] })

function normalizeTechnicianPhone(value){
  const raw=String(value||'').trim()
  if(!raw)return ''
  const digits=raw.replace(/\D/g,'')
  if(raw.startsWith('+'))return '+'+digits
  if(raw.startsWith('00'))return '+'+digits.slice(2)
  if(/^3\d{9}$/.test(digits))return '+39'+digits
  if(/^39\d{10}$/.test(digits))return '+'+digits
  return raw
}

function TechnicianCard({ tech, skills, dispatchCount, onOpen }){
  const wa=whatsappLink(tech.phone)
  const cardClass='rs-technician-card '+(tech.active===false?'is-inactive':'')
  const stateClass='rs-technician-card__state '+(tech.active===false?'is-off':'is-on')
  return <button type="button" className={cardClass} onClick={()=>onOpen(tech)}>
    <div className="rs-technician-card__top">
      <span className="rs-technician-card__avatar">{String(tech.name||'?').trim().slice(0,1).toUpperCase()}</span>
      <span className="rs-technician-card__identity"><strong>{tech.name}</strong><small>{tech.company||'Tecnico esterno'}</small></span>
      <span className={stateClass}>{tech.active===false?'Inattivo':'Attivo'}</span>
    </div>
    <div className="rs-technician-card__skills">
      {skills.length?skills.slice(0,3).map((skill)=><span key={skill}>{skill}</span>):<span>Nessuna competenza assegnata</span>}
      {skills.length>3&&<span>+{skills.length-3}</span>}
    </div>
    <div className="rs-technician-card__meta">
      <span><Icon name="phone"/>{tech.phone||'Telefono mancante'}</span>
      <span><Icon name="wrench"/>{dispatchCount} incarichi</span>
    </div>
    <div className="rs-technician-card__actions">
      {wa&&tech.active!==false&&<a href={wa} target="_blank" rel="noopener noreferrer" onClick={(e)=>e.stopPropagation()}><Icon name="message"/>WhatsApp</a>}
      {tech.email&&<a href={'mailto:'+tech.email} onClick={(e)=>e.stopPropagation()}><Icon name="mail"/>Email</a>}
      <span>Apri scheda <Icon name="chevronRight"/></span>
    </div>
  </button>
}

export default function TechnicianDirectoryView({ user, hotel, createSignal=0 }){
  const [technicians,setTechnicians]=useState([])
  const [competencies,setCompetencies]=useState([])
  const [links,setLinks]=useState([])
  const [dispatches,setDispatches]=useState([])
  const [query,setQuery]=useState('')
  const [skillFilter,setSkillFilter]=useState('all')
  const [statusFilter,setStatusFilter]=useState('active')
  const [selected,setSelected]=useState(null)
  const [draft,setDraft]=useState(emptyTechnician())
  const [editOpen,setEditOpen]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const canManage=canManageTechnicianDirectory(user)

  const load=useCallback(async()=>{
    if(!supabase||!hotel?.id)return
    const [techRes,compRes,linkRes,dispatchRes]=await Promise.all([
      supabase.from('external_technicians').select('id,hotel_id,name,phone,company,email,notes,active,updated_at').eq('hotel_id',hotel.id).order('active',{ascending:false}).order('name'),
      supabase.from('technician_competencies').select('id,code,label,active').eq('active',true).order('label'),
      supabase.from('external_technician_competencies').select('technician_id,competency_id'),
      supabase.from('technician_dispatch_requests').select('id,technician_id,status,created_at').eq('hotel_id',hotel.id).order('created_at',{ascending:false}),
    ])
    const error=techRes.error||compRes.error||linkRes.error||dispatchRes.error
    if(error)throw error
    setTechnicians(techRes.data||[])
    setCompetencies(compRes.data||[])
    setLinks(linkRes.data||[])
    setDispatches(dispatchRes.data||[])
  },[hotel?.id])

  useEffect(()=>{
    load().catch((error)=>setMessage(error?.message||'Rubrica tecnici non disponibile'))
    if(!supabase||!hotel?.id)return undefined
    const channel=supabase.channel('randapp-technicians-'+hotel.id)
    channel.on('postgres_changes',{event:'*',schema:'public',table:'external_technicians',filter:'hotel_id=eq.'+hotel.id},()=>load().catch(()=>{}))
    channel.on('postgres_changes',{event:'*',schema:'public',table:'external_technician_competencies'},()=>load().catch(()=>{}))
    channel.on('postgres_changes',{event:'*',schema:'public',table:'technician_dispatch_requests',filter:'hotel_id=eq.'+hotel.id},()=>load().catch(()=>{}))
    channel.subscribe()
    return()=>{supabase.removeChannel(channel)}
  },[hotel?.id,load])

  useEffect(()=>{if(createSignal&&canManage){setDraft(emptyTechnician());setMessage('');setEditOpen(true)}},[createSignal,canManage])

  const competencyMap=useMemo(()=>Object.fromEntries(competencies.map((item)=>[item.id,item.label])),[competencies])
  const skillIdsFor=(id)=>links.filter((item)=>item.technician_id===id).map((item)=>item.competency_id)
  const labelsFor=(id)=>skillIdsFor(id).map((skillId)=>competencyMap[skillId]).filter(Boolean)
  const dispatchCountFor=(id)=>dispatches.filter((item)=>item.technician_id===id).length
  const activeDispatchFor=(id)=>dispatches.filter((item)=>item.technician_id===id&&['authorized','dispatched','in_progress','awaiting_internal_close'].includes(item.status)).length

  const visible=useMemo(()=>{
    const needle=query.trim().toLowerCase()
    return technicians.filter((tech)=>{
      const skills=labelsFor(tech.id)
      if(statusFilter==='active'&&tech.active===false)return false
      if(statusFilter==='inactive'&&tech.active!==false)return false
      if(skillFilter!=='all'&&!skillIdsFor(tech.id).includes(skillFilter))return false
      if(!needle)return true
      return (tech.name+' '+(tech.company||'')+' '+(tech.phone||'')+' '+(tech.email||'')+' '+(tech.notes||'')+' '+skills.join(' ')).toLowerCase().includes(needle)
    })
  },[technicians,query,statusFilter,skillFilter,links,competencyMap])

  const stats=useMemo(()=>({
    total:technicians.length,
    active:technicians.filter((x)=>x.active!==false).length,
    engaged:new Set(dispatches.filter((x)=>['authorized','dispatched','in_progress','awaiting_internal_close'].includes(x.status)).map((x)=>x.technician_id).filter(Boolean)).size,
    skills:new Set(links.map((x)=>x.competency_id)).size,
  }),[technicians,dispatches,links])

  const openNew=()=>{if(canManage){setDraft(emptyTechnician());setMessage('');setEditOpen(true)}}
  const openEdit=(tech)=>{if(canManage){setDraft({...emptyTechnician(),...tech,competencyIds:skillIdsFor(tech.id)});setMessage('');setEditOpen(true)}}
  const closeEdit=()=>{if(!busy){setEditOpen(false);setDraft(emptyTechnician())}}
  const toggleCompetency=(id)=>setDraft((current)=>({...current,competencyIds:current.competencyIds.includes(id)?current.competencyIds.filter((value)=>value!==id):[...current.competencyIds,id]}))

  const save=async(event)=>{
    event.preventDefault()
    if(!canManage||busy)return
    const name=String(draft.name||'').trim()
    const phone=normalizeTechnicianPhone(draft.phone)
    if(!name){setMessage('Inserisci il nome del tecnico.');return}
    if(!/^\+[1-9]\d{7,14}$/.test(phone)){setMessage('Inserisci un numero WhatsApp valido in formato internazionale.');return}
    setBusy(true);setMessage('')
    try{
      const {data:technicianId,error}=await supabase.rpc('technician_manage_directory',{p_hotel_id:hotel.id,p_technician_id:draft.id||null,p_name:name,p_phone:phone,p_company:String(draft.company||'').trim()||null,p_email:String(draft.email||'').trim()||null,p_notes:String(draft.notes||'').trim()||null,p_active:Boolean(draft.active)})
      if(error)throw error
      const {error:competencyError}=await supabase.rpc('technician_set_competencies',{p_hotel_id:hotel.id,p_technician_id:technicianId,p_competency_ids:draft.competencyIds})
      if(competencyError)throw competencyError
      setEditOpen(false);setDraft(emptyTechnician());setMessage('Tecnico salvato.');await load()
    }catch(error){setMessage(error?.message||'Salvataggio tecnico non riuscito')}
    finally{setBusy(false)}
  }

  const selectedSkills=selected?labelsFor(selected.id):[]
  const selectedDispatches=selected?dispatches.filter((item)=>item.technician_id===selected.id).slice(0,3):[]

  return <Stack gap="sm" className="rs-technicians-page" data-testid="technicians-view">
    <PageTitle eyebrow="MANUTENZIONE" title="Rubrica tecnici" subtitle={'Tecnici esterni, competenze e disponibilità operativa · '+hotel.name} actions={canManage?<Button type="button" variant="primary" icon="add" onClick={openNew}>Nuovo tecnico</Button>:null}/>

    <Grid columns={4} gap="xs" className="rs-technician-stats">
      <Surface><small>Totali</small><strong>{stats.total}</strong><span>in rubrica</span></Surface>
      <Surface><small>Attivi</small><strong>{stats.active}</strong><span>contattabili</span></Surface>
      <Surface><small>Impegnati</small><strong>{stats.engaged}</strong><span>con incarichi aperti</span></Surface>
      <Surface><small>Competenze</small><strong>{stats.skills}</strong><span>coperte</span></Surface>
    </Grid>

    <Surface className="rs-technician-toolbar">
      <label className="rs-technician-search"><Icon name="search"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cerca nome, ditta, telefono, competenza…"/></label>
      <div className="rs-technician-filters">
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} aria-label="Filtra stato tecnico"><option value="active">Attivi</option><option value="all">Tutti</option><option value="inactive">Inattivi</option></select>
        <select value={skillFilter} onChange={(e)=>setSkillFilter(e.target.value)} aria-label="Filtra competenza"><option value="all">Tutte le competenze</option>{competencies.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </div>
    </Surface>

    {message&&<p className="rs-badge rs-badge--accent rs-technician-message">{message}</p>}

    {!visible.length?<EmptyState icon="wrench" title="Nessun tecnico trovato">{technicians.length?'Modifica ricerca o filtri.':canManage?'Aggiungi il primo tecnico esterno.':'Non ci sono tecnici esterni registrati.'}</EmptyState>:
      <Grid columns={2} gap="sm" className="rs-technician-grid">{visible.map((tech)=><TechnicianCard key={tech.id} tech={tech} skills={labelsFor(tech.id)} dispatchCount={dispatchCountFor(tech.id)} onOpen={setSelected}/>)}</Grid>}

    <Sheet open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?.name||'Tecnico'}>
      {selected&&<div className="rs-technician-detail">
        <div className="rs-technician-detail__hero"><span className="rs-technician-card__avatar">{selected.name.slice(0,1).toUpperCase()}</span><div><strong>{selected.name}</strong><small>{selected.company||'Tecnico esterno'}</small></div><span className={'rs-technician-card__state '+(selected.active===false?'is-off':'is-on')}>{selected.active===false?'Inattivo':'Attivo'}</span></div>
        <div className="rs-technician-detail__contacts">
          {selected.phone&&<a href={whatsappLink(selected.phone)||('tel:'+selected.phone)} target="_blank" rel="noopener noreferrer"><Icon name="message"/><span><small>WhatsApp</small><strong>{selected.phone}</strong></span></a>}
          {selected.email&&<a href={'mailto:'+selected.email}><Icon name="mail"/><span><small>Email</small><strong>{selected.email}</strong></span></a>}
        </div>
        <section><small>COMPETENZE</small><div className="rs-technician-detail__chips">{selectedSkills.length?selectedSkills.map((x)=><span key={x}>{x}</span>):<span>Nessuna competenza assegnata</span>}</div></section>
        <section><small>ATTIVITÀ</small><div className="rs-technician-detail__activity"><strong>{dispatchCountFor(selected.id)} incarichi totali</strong><span>{activeDispatchFor(selected.id)} attivi adesso</span>{selectedDispatches.map((x)=><small key={x.id}>{x.status} · {new Date(x.created_at).toLocaleDateString('it-IT')}</small>)}</div></section>
        {selected.notes&&<section><small>NOTE</small><p>{selected.notes}</p></section>}
        {canManage&&<Button type="button" variant="primary" icon="edit" onClick={()=>{const current=selected;setSelected(null);openEdit(current)}}>Modifica tecnico</Button>}
      </div>}
    </Sheet>

    <Sheet open={editOpen} onClose={closeEdit} title={draft.id?'Modifica tecnico':'Nuovo tecnico'}>
      <form className="rs-migrated-form" onSubmit={save} data-testid="technician-form">
        <Field label="Nome tecnico"><TextInput value={draft.name} onChange={(e)=>setDraft((x)=>({...x,name:e.target.value}))} placeholder="Nome e cognome" autoFocus/></Field>
        <Field label="WhatsApp"><TextInput value={draft.phone} inputMode="tel" onChange={(e)=>setDraft((x)=>({...x,phone:e.target.value}))} placeholder="+39 334 119 6935"/></Field>
        <Field label="Ditta"><TextInput value={draft.company} onChange={(e)=>setDraft((x)=>({...x,company:e.target.value}))} placeholder="Azienda o ditta"/></Field>
        <Field label="Email"><TextInput type="email" value={draft.email} onChange={(e)=>setDraft((x)=>({...x,email:e.target.value}))} placeholder="email@azienda.it"/></Field>
        <fieldset className="rs-fieldset"><legend>Competenze</legend><div className="rs-chips">{competencies.map((item)=><button type="button" key={item.id} className={'rs-chip '+(draft.competencyIds.includes(item.id)?'active':'')} onClick={()=>toggleCompetency(item.id)}>{draft.competencyIds.includes(item.id)?'✓ ':''}{item.label}</button>)}</div></fieldset>
        <Field label="Note operative"><textarea className="rs-textarea" rows="4" value={draft.notes} onChange={(e)=>setDraft((x)=>({...x,notes:e.target.value}))} placeholder="Disponibilità, orari, riferimenti, indicazioni…"/></Field>
        <label className="rs-technician-active-toggle"><input type="checkbox" checked={draft.active} onChange={(e)=>setDraft((x)=>({...x,active:e.target.checked}))}/><span>Tecnico attivo e contattabile</span></label>
        {message&&<p className="rs-error">{message}</p>}
        <div className="rs-form-actions"><Button type="button" variant="ghost" onClick={closeEdit} disabled={busy}>Annulla</Button><Button type="submit" variant="primary" disabled={busy}>{busy?'Salvo…':'Salva tecnico'}</Button></div>
      </form>
    </Sheet>
  </Stack>
}
