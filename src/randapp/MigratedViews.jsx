import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanned, updatePlannedRow, subscribePlanned } from '../planned-data.js'
import { fetchUrgents, insertUrgent, updateUrgentRow, subscribeUrgents } from '../urgents-data.js'
import { fetchFeedback, insertFeedback, subscribeFeedback } from '../feedback-data.js'
import { changeOwnPin, updateOwnProfile, setOwnPresence } from '../auth-data.js'
import { PlanningWork, PlanningSale } from '../planning.jsx'
import { TemperatureSensors } from '../temperature.jsx'
import { Housekeeping } from '../housekeeping.jsx'
import { Button, Card, EmptyState, Field, Icon, Spinner, TextInput } from './ui.jsx'

const fmt = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const whatsappLink = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  return digits ? `https://wa.me/${digits.replace(/^\+/, '')}` : null
}

function PageTitle({ title, subtitle, action }) {
  return <div className="rs-page-title"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function statusTone(status) {
  if (['done', 'completata'].includes(status)) return 'done'
  if (['presa_in_carico', 'in_progress'].includes(status)) return 'tecnico'
  if (['da_finire', 'waiting'].includes(status)) return 'waiting'
  return 'todo'
}

function StatusPill({ status }) {
  const labels = { pending: 'Da fare', in_progress: 'In corso', da_finire: 'Da finire', done: 'Fatto', aperta: 'Aperta', presa_in_carico: 'Presa in carico', completata: 'Completata' }
  return <span className={`rs-badge rs-badge--${statusTone(status)}`}>{labels[status] || status}</span>
}

export function InterventionsView({ hotel, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const load = useCallback(async () => { const result = await fetchPlanned(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribePlanned(hotel.id, load) }, [hotel.id, load])
  const visible = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'done' ? item.status === 'done' : item.status !== 'done')), [items, filter])
  const markDone = async (item) => { await updatePlannedRow(item.id, { hotelId: hotel.id, status: 'done', completedBy: user?.name, completedAt: Date.now() }); load() }
  return <div data-testid="interventions-view">
    <PageTitle title="Interventi" subtitle={`${hotel.name} · ${items.filter(i => i.status !== 'done').length} aperti`} />
    <div className="rs-segmented rs-migrated-tabs">
      {[['active','Aperti'],['done','Fatti'],['all','Tutti']].map(([id,label]) => <button type="button" key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}
    </div>
    {loading ? <Spinner label="Carico interventi…" /> : !visible.length ? <EmptyState icon="wrench" title="Nessun intervento">Non ci sono elementi per questo filtro.</EmptyState> : <div className="rs-migrated-list">
      {visible.map((item) => <Card key={item.id} className="rs-card--pad rs-op-card">
        <div className="rs-op-card__head"><div><strong>{item.location || 'Intervento'}</strong><small>{item.category || 'Manutenzione'} · {fmt(item.scheduledAt)}</small></div><StatusPill status={item.status} /></div>
        {item.notes && <p>{item.notes}</p>}
        {!!item.assignees?.length && <small>Assegnato a: {item.assignees.map(p => p.name || p).join(', ')}</small>}
        {item.status !== 'done' && <div className="rs-op-card__actions"><Button variant="outline" icon="check" onClick={()=>markDone(item)}>Segna fatto</Button></div>}
      </Card>)}
    </div>}
  </div>
}

export function PlanningWorkView({ hotel }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { const result = await fetchPlanned(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribePlanned(hotel.id, load) }, [hotel.id, load])
  if (loading) return <Spinner label="Carico planning…" />
  return <div className="rs-legacy rs-legacy--planning" data-testid="planning-work-view"><PlanningWork items={items} onOpen={()=>{}} /></div>
}

export function PlanningSaleView({ hotel, user }) {
  return <div className="rs-legacy rs-legacy--planning" data-testid="planning-sale-view"><PlanningSale hotel={hotel} user={user} /></div>
}

export function UrgentView({ hotel, user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(async () => { const result = await fetchUrgents(hotel.id); setItems(result.items || []); setLoading(false) }, [hotel.id])
  useEffect(() => { load(); return subscribeUrgents(hotel.id, load) }, [hotel.id, load])
  const create = async (e) => { e.preventDefault(); if (!note.trim()) return; await insertUrgent({ hotelId: hotel.id, note: note.trim(), createdBy: user?.name, severity: 'urgente' }); setNote(''); setCreating(false); load() }
  const take = async (item) => { await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'presa_in_carico', takenBy: user?.name }); load() }
  const done = async (item) => { await updateUrgentRow(item.id, { hotelId: hotel.id, status: 'completata', completedBy: user?.name }); load() }
  return <div data-testid="urgent-view">
    <PageTitle title="Avvisi urgenti" subtitle={`${hotel.name} · ${items.filter(i=>i.status!=='completata').length} attivi`} action={<Button icon="plus" onClick={()=>setCreating(v=>!v)}>Nuovo</Button>} />
    {creating && <Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={create}><Field label="Messaggio urgente"><textarea className="rs-textarea" rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Descrivi l'urgenza…" /></Field><Button type="submit" disabled={!note.trim()}>Invia avviso</Button></form></Card>}
    {loading ? <Spinner label="Carico avvisi…" /> : !items.length ? <EmptyState icon="warning" title="Nessun avviso urgente">La struttura non ha avvisi attivi.</EmptyState> : <div className="rs-migrated-list">
      {items.map(item => <Card key={item.id} className="rs-card--pad rs-op-card">
        <div className="rs-op-card__head"><div><strong>{item.location || 'Avviso urgente'}</strong><small>{fmt(item.createdAt)} · {item.createdBy || '—'}</small></div><StatusPill status={item.status}/></div>
        <p>{item.note}</p>
        {item.status==='aperta' && <div className="rs-op-card__actions"><Button variant="outline" onClick={()=>take(item)}>Prendi in carico</Button></div>}
        {item.status==='presa_in_carico' && <div className="rs-op-card__actions"><Button icon="check" onClick={()=>done(item)}>Completa</Button></div>}
      </Card>)}
    </div>}
  </div>
}

export function TemperatureView({ hotel }) {
  return <div className="rs-legacy rs-legacy--temperature" data-testid="temperature-view"><TemperatureSensors hotel={hotel} /></div>
}

export function HousekeepingView({ hotel, user }) {
  return <div className="rs-legacy rs-legacy--housekeeping" data-testid="housekeeping-view"><Housekeeping hotel={hotel} user={user} /></div>
}

export function TechnicianDirectoryView({ users = [], hotel }) {
  const technicians = users.filter(person => person.role === 'Tecnico esterno').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'))
  return <div data-testid="technicians-view"><PageTitle title="Rubrica tecnici" subtitle={hotel.name} />
    {!technicians.length ? <EmptyState icon="phone" title="Nessun tecnico esterno">Aggiungi i tecnici da Gestione utenti con ruolo “Tecnico esterno”.</EmptyState> : <div className="rs-migrated-list">{technicians.map(tech => { const wa=whatsappLink(tech.phone); return <Card className="rs-card--pad rs-tech-card" key={tech.id || tech.name}><div><strong>{tech.name}</strong><small>{tech.phone || 'Numero non inserito'}</small></div>{wa && <a className="rs-btn rs-btn--outline rs-btn--sm" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="message"/><span>WhatsApp</span></a>}</Card> })}</div>}
  </div>
}

export function FeedbackView({ hotel, user, received = false }) {
  const [items, setItems] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { if (!received) return; const result=await fetchFeedback(hotel.id); setItems(result.items || []) }, [hotel.id, received])
  useEffect(()=>{ if (!received) return undefined; load(); return subscribeFeedback(hotel.id, load) },[hotel.id,received,load])
  const submit=async(e)=>{e.preventDefault();if(!text.trim())return;setBusy(true);try{await insertFeedback(hotel.id,user?.name||'Utente',text.trim());setText('')}finally{setBusy(false)}}
  if (received) return <div data-testid="feedback-received-view"><PageTitle title="Feedback ricevuti" subtitle={hotel.name}/>{!items.length?<EmptyState icon="message" title="Nessun feedback">Non sono ancora arrivati messaggi.</EmptyState>:<div className="rs-migrated-list">{items.map(item=><Card key={item.id} className="rs-card--pad rs-op-card"><div className="rs-op-card__head"><strong>{item.userName||'Utente'}</strong><small>{fmt(item.createdAt)}</small></div><p>{item.text}</p></Card>)}</div>}</div>
  return <div data-testid="feedback-view"><PageTitle title="Invia feedback" subtitle="Suggerimenti sull'app"/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={submit}><Field label="Messaggio"><textarea className="rs-textarea" rows="6" value={text} onChange={e=>setText(e.target.value)} placeholder="Scrivi qui il tuo suggerimento…" /></Field><Button type="submit" disabled={busy||!text.trim()}>{busy?'Invio…':'Invia feedback'}</Button></form></Card></div>
}

export function PinView() {
  const [currentPin,setCurrentPin]=useState(''),[newPin,setNewPin]=useState(''),[confirmPin,setConfirmPin]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const submit=async(e)=>{e.preventDefault();setMessage('');setError('');if(newPin.length!==4||newPin!==confirmPin)return setError('Il nuovo PIN deve essere di 4 cifre e coincidere.');setBusy(true);try{await changeOwnPin({currentPin,newPin});setCurrentPin('');setNewPin('');setConfirmPin('');setMessage('PIN aggiornato correttamente.')}catch(err){setError(err?.message||'Cambio PIN non riuscito')}finally{setBusy(false)}}
  const pinProps=(value,setter)=>({value,inputMode:'numeric',autoComplete:'off',onChange:e=>setter(e.target.value.replace(/\D/g,'').slice(0,4))})
  return <div data-testid="pin-view"><PageTitle title="Cambia PIN" subtitle="Proteggi il tuo account"/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={submit}><Field label="PIN attuale"><TextInput icon="lock" {...pinProps(currentPin,setCurrentPin)} /></Field><Field label="Nuovo PIN"><TextInput icon="lock" {...pinProps(newPin,setNewPin)} /></Field><Field label="Ripeti nuovo PIN"><TextInput icon="lock" {...pinProps(confirmPin,setConfirmPin)} /></Field>{error&&<p className="rs-error">{error}</p>}{message&&<p className="rs-success">{message}</p>}<Button type="submit" disabled={busy||currentPin.length!==4||newPin.length!==4||confirmPin.length!==4}>{busy?'Salvo…':'Aggiorna PIN'}</Button></form></Card></div>
}

export function ProfileDetailsView({ user, hotel }) {
  const [email,setEmail]=useState(user?.email||''),[phone,setPhone]=useState(user?.phone||''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{setEmail(user?.email||'');setPhone(user?.phone||'')},[user])
  const save=async(e)=>{e.preventDefault();setBusy(true);setMessage('');try{await updateOwnProfile({email,phone});setMessage('Profilo aggiornato.')}catch(err){setMessage(err?.message||'Aggiornamento non riuscito')}finally{setBusy(false)}}
  const presence=async(value)=>{setBusy(true);try{await setOwnPresence(value);setMessage(value?'Presenza attivata.':'Presenza disattivata.')}finally{setBusy(false)}}
  return <div data-testid="profile-details-view"><PageTitle title="Dati profilo" subtitle={hotel.name}/><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={save}><Field label="Email"><TextInput value={email} type="email" onChange={e=>setEmail(e.target.value)}/></Field><Field label="Telefono"><TextInput value={phone} inputMode="tel" onChange={e=>setPhone(e.target.value)}/></Field><div className="rs-op-card__actions"><Button type="submit" disabled={busy}>Salva</Button><Button type="button" variant="outline" onClick={()=>presence(true)}>Sono in struttura</Button><Button type="button" variant="ghost" onClick={()=>presence(false)}>Fuori struttura</Button></div>{message&&<p className="rs-muted">{message}</p>}</form></Card></div>
}

export function ManualView() {
  return <div data-testid="manual-view"><PageTitle title="Manuale" subtitle="Guida rapida RandApp"/><div className="rs-migrated-list">
    {[['Segnalazioni','Crea una segnalazione con il pulsante +, aggiungi posizione, categoria, descrizione e foto.'],['Interventi','Consulta i lavori assegnati e aggiorna lo stato quando il lavoro è completato.'],['Avvisi urgenti','Gli avvisi urgenti sono sincronizzati in tempo reale e possono essere presi in carico.'],['Planning','Usa Planning lavori e, per Hotel Giò, Planning sale per consultare le attività programmate.'],['Struttura','Tocca il nome dell’hotel nell’intestazione per cambiare struttura quando il tuo account ne gestisce più di una.'],['Aspetto','Tema Sistema/Chiaro/Scuro e dimensione Piccolo/Normale/Grande sono disponibili in Profilo e nel menu.']].map(([title,text])=><Card key={title} className="rs-card--pad rs-manual-card"><strong>{title}</strong><p>{text}</p></Card>)}
  </div></div>
}
