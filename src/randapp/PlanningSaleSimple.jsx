import { useEffect, useMemo, useState } from 'react'
import { deleteBookingRow, fetchBookings, insertBooking, subscribeBookings, updateBookingRow } from '../sale-data.js'
import { fetchSaleRooms, saveSaleRoom, setSaleRoomActive, subscribeSaleRooms } from '../sale-config-data.js'
import { Button, Icon, Sheet } from './ui.jsx'

const SHIFTS={mattina:'Mattina',pomeriggio:'Pomeriggio',tutto_giorno:'Giornata intera'}
const WD=['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const norm=(value='')=>String(value).trim().toLocaleLowerCase('it')
export const canManageSalePlanning=(user)=>norm(user?.role)==='direttore centro congressi'
export const canOperateSalePlanning=(user)=>canManageSalePlanning(user)||norm(user?.role)==='manutentore'
const iso=(value=new Date())=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const addDays=(value,n)=>{const d=new Date(value);d.setDate(d.getDate()+n);return d}
const dayLabel=(value)=>`${WD[value.getDay()]} ${String(value.getDate()).padStart(2,'0')}/${String(value.getMonth()+1).padStart(2,'0')}`
const overlaps=(aFrom,aTo,bFrom,bTo)=>aFrom<=bTo&&aTo>=bFrom

function roomIndex(rooms){
  const byKey=new Map(),byName=new Map()
  rooms.forEach((room)=>{byKey.set(room.key,room);byName.set(room.name,room)})
  return {byKey,byName}
}
function roomForBooking(booking,index){return (booking.roomKey&&index.byKey.get(booking.roomKey))||index.byName.get(booking.room)||null}
function shareParts(a,b){return Boolean(a&&b&&(a.parts||[]).some((part)=>(b.parts||[]).includes(part)))}
function roomAvailability(room,dateFrom,dateTo,shift,bookings,index,excludeId=null){
  const rows=bookings.filter((item)=>item.id!==excludeId&&overlaps(item.dateFrom||item.date,item.dateTo||item.date,dateFrom,dateTo)).filter((item)=>{
    const booked=roomForBooking(item,index)
    return booked?shareParts(booked,room):item.room===room.name
  })
  const morning=rows.some((item)=>item.shift==='mattina'||item.shift==='tutto_giorno')
  const afternoon=rows.some((item)=>item.shift==='pomeriggio'||item.shift==='tutto_giorno')
  if(shift==='mattina')return morning?'busy':'free'
  if(shift==='pomeriggio')return afternoon?'busy':'free'
  if(morning&&afternoon)return'busy'
  if(morning||afternoon)return'partial'
  return'free'
}
function Metric({value,label,tone='normal'}){const color=tone==='done'?'var(--rs-ok)':tone==='finish'?'var(--rs-warn)':'var(--rs-text)';return <div style={{border:'1px solid var(--rs-line)',borderRadius:14,padding:'10px 8px',background:'var(--rs-surface)',textAlign:'center'}}><b style={{display:'block',fontFamily:'Sora',fontSize:'1.15rem',color}}>{value}</b><small style={{color:'var(--rs-text-3)'}}>{label}</small></div>}

function RoomConfigSheet({open,onClose,hotel,rooms,onSaved}){
  const [editing,setEditing]=useState(null)
  const [draft,setDraft]=useState({name:'',family:'',mode:'simple',selected:[]})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const active=rooms.filter((room)=>room.active)
  const bases=active.filter((room)=>room.parts?.length===1&&room.key!==editing?.key)
  const reset=()=>{setEditing(null);setDraft({name:'',family:'',mode:'simple',selected:[]});setError('')}
  useEffect(()=>{if(!open)reset()},[open])
  const edit=(room)=>{
    const selected=bases.filter((base)=>(base.parts||[]).every((part)=>(room.parts||[]).includes(part))).map((base)=>base.key)
    setEditing(room);setDraft({name:room.name,family:room.family||room.name,mode:(room.parts?.length||0)>1?'combo':'simple',selected});setError('')
  }
  const save=async(e)=>{
    e.preventDefault();if(!draft.name.trim()||busy)return
    setBusy(true);setError('')
    try{
      const key=editing?.key||`room-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)}`
      let parts=editing?.parts||[]
      if(draft.mode==='simple')parts=editing?.parts?.length===1?editing.parts:[`part:${key}`]
      else{
        const chosen=bases.filter((room)=>draft.selected.includes(room.key))
        parts=[...new Set(chosen.flatMap((room)=>room.parts||[]))]
        if(parts.length<2)throw new Error('Seleziona almeno due sale base per creare una combinazione.')
      }
      await saveSaleRoom({hotelId:hotel.id,key,name:draft.name.trim(),family:(draft.family||draft.name).trim(),parts,active:true,sortOrder:editing?.sortOrder??(rooms.length+1)*10})
      await onSaved();reset()
    }catch(err){setError(err?.message||'Configurazione non salvata')}
    finally{setBusy(false)}
  }
  const toggle=async(room)=>{setBusy(true);setError('');try{await setSaleRoomActive(hotel.id,room.key,!room.active);await onSaved()}catch(err){setError(err?.message||'Modifica non riuscita')}finally{setBusy(false)}}
  return <Sheet open={open} onClose={onClose} className="rs-sale-sheet">
    <div style={{display:'grid',gap:16}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><small style={{color:'var(--rs-cyan)',fontWeight:800}}>Solo Direttore Centro Congressi</small><h2 style={{margin:'3px 0 0',fontFamily:'Sora'}}>Configurazione sale</h2><p style={{margin:'5px 0 0',color:'var(--rs-text-3)',fontSize:'.8rem'}}>{hotel.name} · questa configurazione alimenta disponibilità e prenotazioni.</p></div><button type="button" className="rs-iconbtn" onClick={onClose}><Icon name="close"/></button></header>
      <div style={{display:'grid',gap:8}}>{rooms.length?rooms.map((room)=><div key={room.key} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,alignItems:'center',padding:11,border:'1px solid var(--rs-line)',borderRadius:14,background:'var(--rs-surface)',opacity:room.active?1:.55}}><div style={{minWidth:0}}><strong style={{display:'block'}}>{room.name}</strong><small style={{color:'var(--rs-text-3)'}}>{room.family}{room.parts?.length>1?` · combina ${room.parts.length} moduli`:''}</small></div><button type="button" className="rs-iconbtn" onClick={()=>edit(room)} aria-label="Modifica"><Icon name="edit"/></button><button type="button" className="rs-btn rs-btn--ghost" disabled={busy} onClick={()=>toggle(room)}>{room.active?'Disattiva':'Attiva'}</button></div>):<p style={{margin:0,color:'var(--rs-text-3)'}}>Nessuna sala configurata per questa struttura.</p>}</div>
      <form onSubmit={save} style={{display:'grid',gap:12,paddingTop:6,borderTop:'1px solid var(--rs-line)'}}>
        <strong>{editing?'Modifica sala':'Aggiungi sala'}</strong>
        <label className="rs-field"><span className="rs-field__label">Nome *</span><input value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})} placeholder="Es. Sala Verde"/></label>
        <label className="rs-field"><span className="rs-field__label">Famiglia</span><input value={draft.family} onChange={(e)=>setDraft({...draft,family:e.target.value})} placeholder="Es. Trumpet"/></label>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button type="button" className={`rs-btn ${draft.mode==='simple'?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setDraft({...draft,mode:'simple',selected:[]})}>Sala singola</button><button type="button" className={`rs-btn ${draft.mode==='combo'?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setDraft({...draft,mode:'combo'})}>Combinazione</button></div>
        {draft.mode==='combo'&&<fieldset style={{border:0,padding:0,margin:0,display:'grid',gap:7}}><legend style={{fontWeight:800}}>Sale che compongono la combinazione</legend><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:7}}>{bases.map((room)=><button type="button" key={room.key} className={`rs-btn ${draft.selected.includes(room.key)?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setDraft({...draft,selected:draft.selected.includes(room.key)?draft.selected.filter((key)=>key!==room.key):[...draft.selected,room.key]})}>{room.name}</button>)}</div></fieldset>}
        {error&&<p style={{margin:0,color:'#e35d6a'}}>{error}</p>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{editing&&<button type="button" className="rs-btn rs-btn--ghost" onClick={reset}>Annulla</button>}<Button type="submit" variant="primary" disabled={busy||!draft.name.trim()}>{busy?'Salvo…':editing?'Salva':'Aggiungi'}</Button></div>
      </form>
    </div>
  </Sheet>
}

function BookingForm({open,onClose,hotel,user,bookings,rooms,initial,onSaved}){
  const today=iso(),index=useMemo(()=>roomIndex(rooms),[rooms])
  const [draft,setDraft]=useState({client:'',dateFrom:today,dateTo:today,shift:'mattina',roomKey:'',notes:''})
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(!open)return;const configured=initial?roomForBooking(initial,index):null;setDraft(initial?{client:initial.client||'',dateFrom:initial.dateFrom||initial.date||today,dateTo:initial.dateTo||initial.date||today,shift:initial.shift||'mattina',roomKey:configured?.key||initial.roomKey||'',notes:initial.notes||''}:{client:'',dateFrom:today,dateTo:today,shift:'mattina',roomKey:'',notes:''});setError('')},[open,initial?.id,rooms.length])
  const choices=useMemo(()=>rooms.filter((room)=>room.active||room.key===draft.roomKey),[rooms,draft.roomKey])
  const clientNames=useMemo(()=>[...new Set(bookings.map((b)=>b.client).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')),[bookings])
  const usualKey=useMemo(()=>{const key=norm(draft.client);if(!key)return null;const counts=new Map();bookings.filter((b)=>norm(b.client)===key).forEach((b)=>{const room=roomForBooking(b,index);if(room)counts.set(room.key,(counts.get(room.key)||0)+1)});return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null},[draft.client,bookings,index])
  const statusFor=(room)=>roomAvailability(room,draft.dateFrom,draft.dateTo,draft.shift,bookings,index,initial?.id)
  const selected=choices.find((room)=>room.key===draft.roomKey)||null
  const selectedStatus=selected?statusFor(selected):null
  const validRange=draft.dateFrom&&draft.dateTo&&draft.dateTo>=draft.dateFrom
  const canSave=draft.client.trim()&&selected&&validRange&&selectedStatus==='free'
  const usual=usualKey?choices.find((room)=>room.key===usualKey):null
  const save=async(e)=>{e.preventDefault();if(!canSave||saving)return;setSaving(true);setError('');try{const payload={roomKey:selected.key,room:selected.name,dateFrom:draft.dateFrom,dateTo:draft.dateTo,shift:draft.shift,client:draft.client.trim(),notes:draft.notes.trim(),hotelId:hotel.id};if(initial)await updateBookingRow(initial.id,payload);else await insertBooking({...payload,status:'pending',createdBy:user.name,createdAt:Date.now()});await onSaved();onClose()}catch(err){setError(err?.message||'Salvataggio non riuscito')}finally{setSaving(false)}}
  return <Sheet open={open} onClose={onClose} className="rs-sale-sheet"><form onSubmit={save} style={{display:'grid',gap:16}}>
    <header style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className="rs-btn rs-btn--ghost" onClick={onClose}>‹</button><div><h2 style={{margin:0,fontFamily:'Sora'}}>{initial?'Modifica prenotazione':'Nuova prenotazione'}</h2><small style={{color:'var(--rs-text-3)'}}>Periodo e turno determinano subito le sale disponibili.</small></div></header>
    <label className="rs-field"><span className="rs-field__label">Cliente *</span><input list="sale-client-list" value={draft.client} onChange={(e)=>setDraft({...draft,client:e.target.value})} placeholder="Nome cliente / azienda"/><datalist id="sale-client-list">{clientNames.map((name)=><option key={name} value={name}/>)}</datalist></label>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}><label className="rs-field"><span className="rs-field__label">Da *</span><input type="date" value={draft.dateFrom} onChange={(e)=>setDraft({...draft,dateFrom:e.target.value,dateTo:draft.dateTo<e.target.value?e.target.value:draft.dateTo,roomKey:''})}/></label><label className="rs-field"><span className="rs-field__label">A *</span><input type="date" min={draft.dateFrom} value={draft.dateTo} onChange={(e)=>setDraft({...draft,dateTo:e.target.value,roomKey:''})}/></label></div>
    <fieldset style={{border:0,padding:0,margin:0,display:'grid',gap:8}}><legend style={{fontWeight:800}}>Turno *</legend><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>{Object.entries(SHIFTS).map(([key,label])=><button type="button" key={key} className={`rs-btn ${draft.shift===key?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setDraft({...draft,shift:key,roomKey:''})}>{label}</button>)}</div></fieldset>
    {usual&&<button type="button" disabled={statusFor(usual)!=='free'} onClick={()=>setDraft({...draft,roomKey:usual.key})} style={{border:'1px solid var(--rs-line)',borderRadius:14,padding:12,background:'var(--rs-surface-2)',textAlign:'left',color:'var(--rs-text)',opacity:statusFor(usual)==='busy'?.65:1}}><strong>Sala abituale: {usual.name}</strong><small style={{display:'block',marginTop:3,color:statusFor(usual)==='free'?'var(--rs-ok)':'var(--rs-warn)'}}>{statusFor(usual)==='free'?'Disponibile · tocca per selezionare':statusFor(usual)==='partial'?'Disponibilità parziale':'Occupata nel periodo scelto'}</small></button>}
    <section style={{display:'grid',gap:9}}><strong>Disponibilità sale</strong>{choices.length?<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>{choices.map((room)=>{const status=statusFor(room),active=draft.roomKey===room.key,color=status==='free'?'var(--rs-ok)':status==='partial'?'var(--rs-warn)':'#e35d6a';return <button type="button" key={room.key} disabled={status!=='free'} onClick={()=>setDraft({...draft,roomKey:room.key})} style={{minHeight:58,border:`1px solid ${active?'var(--rs-cyan)':'var(--rs-line)'}`,borderRadius:14,padding:'9px 10px',background:active?'color-mix(in srgb,var(--rs-cyan) 12%,var(--rs-surface))':'var(--rs-surface)',textAlign:'left',opacity:status==='busy'?.55:1,color:'var(--rs-text)'}}><strong style={{display:'block',fontSize:'.85rem'}}>{room.name}</strong><small style={{color}}>{status==='free'?'● Disponibile':status==='partial'?'◐ Parziale':'● Occupata'}</small></button>})}</div>:<p style={{margin:0,padding:12,border:'1px dashed var(--rs-line)',borderRadius:14,color:'var(--rs-text-3)'}}>Nessuna sala attiva configurata per questo hotel.</p>}</section>
    <label className="rs-field"><span className="rs-field__label">Note</span><textarea className="rs-textarea" rows="3" value={draft.notes} onChange={(e)=>setDraft({...draft,notes:e.target.value})} placeholder="Allestimento, persone, richieste..."/></label>
    {!validRange&&<p style={{margin:0,color:'#e35d6a'}}>La data finale deve essere uguale o successiva a quella iniziale.</p>}{error&&<p style={{margin:0,color:'#e35d6a'}}>{error}</p>}
    <Button type="submit" variant="primary" size="lg" disabled={!canSave||saving}>{saving?'Salvataggio…':initial?'✓ Salva modifiche':'✓ Prenota'}</Button>
  </form></Sheet>
}

function BookingCard({booking,user,onRefresh,onEdit}){
  const director=canManageSalePlanning(user),maintainer=norm(user?.role)==='manutentore',canStatus=director||maintainer
  const done=booking.status==='done',finish=booking.status==='da_finire'
  const setStatus=async(status)=>{const patch=status==='done'?{status:'done',doneBy:user.name,doneAt:Date.now(),toFinishBy:booking.toFinishBy||null,toFinishAt:booking.toFinishAt||null}:{status:'da_finire',toFinishBy:user.name,toFinishAt:Date.now(),doneBy:null,doneAt:null};await updateBookingRow(booking.id,{...patch,hotelId:booking.hotelId});await onRefresh()}
  return <article style={{border:`1px solid ${done?'color-mix(in srgb,var(--rs-ok) 45%,var(--rs-line))':finish?'color-mix(in srgb,var(--rs-warn) 45%,var(--rs-line))':'var(--rs-line)'}`,background:'var(--rs-surface)',borderRadius:16,padding:12,display:'grid',gap:9}}>
    <div style={{display:'flex',alignItems:'flex-start',gap:10}}><div style={{width:10,height:10,borderRadius:99,marginTop:6,background:done?'var(--rs-ok)':finish?'var(--rs-warn)':'var(--rs-text-3)'}}/><div style={{minWidth:0,flex:1}}><strong style={{display:'block'}}>{booking.room}</strong><span style={{display:'block',color:'var(--rs-text-2)',marginTop:2}}>{booking.client}</span><small style={{display:'block',color:'var(--rs-text-3)',marginTop:4}}>{SHIFTS[booking.shift]} · {booking.dateFrom||booking.date}{(booking.dateTo||booking.date)!==(booking.dateFrom||booking.date)?` → ${booking.dateTo}`:''}</small>{booking.notes&&<small style={{display:'block',marginTop:5,color:'var(--rs-text-2)'}}>{booking.notes}</small>}{finish&&<small style={{display:'block',marginTop:6,color:'var(--rs-warn)',fontWeight:800}}>Da finire · {booking.toFinishBy}{booking.toFinishAt?` · ${new Date(booking.toFinishAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}{done&&<small style={{display:'block',marginTop:6,color:'var(--rs-ok)',fontWeight:800}}>✓ Fatto da {booking.doneBy}{booking.doneAt?` · ${new Date(booking.doneAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}</div>{director&&<button type="button" className="rs-iconbtn" onClick={()=>onEdit(booking)}><Icon name="edit"/></button>}</div>
    {canStatus&&!done&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setStatus('da_finire')}>◐ Da finire</button><button type="button" className="rs-btn rs-btn--primary" onClick={()=>setStatus('done')}>✓ Fatto</button></div>}
  </article>
}

export default function PlanningSaleSimple({hotel,user,openRequest=0}){
  const [bookings,setBookings]=useState([]),[rooms,setRooms]=useState([]),[anchor,setAnchor]=useState(()=>new Date()),[view,setView]=useState('giorno'),[creating,setCreating]=useState(false),[editing,setEditing]=useState(null),[configOpen,setConfigOpen]=useState(false),[error,setError]=useState('')
  const director=canManageSalePlanning(user),allowed=canOperateSalePlanning(user)
  const load=async()=>{if(!allowed)return;try{setError('');const [sales,cfg]=await Promise.all([fetchBookings(hotel.id),fetchSaleRooms(hotel.id,{includeInactive:director})]);setBookings(sales.items||[]);setRooms(cfg||[])}catch(err){setError(err?.message||'Planning sale non disponibile')}}
  useEffect(()=>{if(!allowed)return;load();const offBookings=subscribeBookings(hotel.id,load);const offRooms=subscribeSaleRooms(hotel.id,load);return()=>{offBookings?.();offRooms?.()}},[hotel.id,allowed,director])
  useEffect(()=>{if(openRequest&&director)setCreating(true)},[openRequest,director])
  if(!allowed)return <p style={{margin:0,color:'var(--rs-text-3)'}}>Planning sale disponibile solo a Direttore Centro Congressi e manutentori della struttura.</p>
  const count=view==='giorno'?1:7,days=Array.from({length:count},(_,i)=>addDays(anchor,i)),today=iso(),todayRows=bookings.filter((b)=>(b.dateFrom||b.date)<=today&&(b.dateTo||b.date)>=today),stats={today:todayRows.filter((b)=>b.status!=='done').length,finish:todayRows.filter((b)=>b.status==='da_finire').length,done:todayRows.filter((b)=>b.status==='done').length}
  const shiftAnchor=(n)=>setAnchor((d)=>addDays(d,n))
  const remove=async(booking)=>{if(!director||!window.confirm(`Eliminare la prenotazione di “${booking.client}”?`))return;await deleteBookingRow(booking.id,hotel.id);await load()}
  return <section style={{display:'grid',gap:14}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}><Metric value={stats.today} label="Oggi"/><Metric value={stats.finish} label="Da finire" tone="finish"/><Metric value={stats.done} label="Fatti oggi" tone="done"/></div>
    {director&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Button variant="primary" onClick={()=>setCreating(true)}>＋ Nuova prenotazione</Button><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setConfigOpen(true)}><Icon name="gear"/> Configura sale</button></div>}
    <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,flex:1}}><button type="button" className={`rs-btn ${view==='giorno'?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setView('giorno')}>Giorno</button><button type="button" className={`rs-btn ${view==='settimana'?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setView('settimana')}>Settimana</button></div></div>
    <div style={{display:'grid',gridTemplateColumns:'48px 1fr 48px',gap:8,alignItems:'center'}}><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>shiftAnchor(view==='giorno'?-1:-7)}>‹</button><div style={{textAlign:'center',fontWeight:800}}>{view==='giorno'?dayLabel(anchor):`${dayLabel(days[0])} – ${dayLabel(days[days.length-1])}`}</div><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>shiftAnchor(view==='giorno'?1:7)}>›</button></div>
    <button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(new Date())}>Oggi</button>
    {error&&<p style={{margin:0,color:'#e35d6a'}}>{error}</p>}
    <div style={{display:'grid',gap:14}}>{days.map((day)=>{const date=iso(day),list=bookings.filter((b)=>(b.dateFrom||b.date)<=date&&(b.dateTo||b.date)>=date);return <section key={date} style={{display:'grid',gap:9}}><h3 style={{margin:'5px 0 0',fontFamily:'Sora',color:date===today?'var(--rs-ok)':'var(--rs-text)'}}>{dayLabel(day)}{date===today?' · oggi':''}</h3>{list.length?list.map((booking)=><div key={booking.id} style={{display:'grid',gap:6}}><BookingCard booking={booking} user={user} onRefresh={load} onEdit={setEditing}/>{director&&<button type="button" onClick={()=>remove(booking)} style={{justifySelf:'end',border:0,background:'transparent',color:'#e35d6a',fontSize:'.72rem'}}>Elimina</button>}</div>):<p style={{margin:0,color:'var(--rs-text-3)'}}>Nessuna prenotazione.</p>}</section>})}</div>
    {!director&&<p style={{margin:0,color:'var(--rs-text-3)',fontSize:'.78rem'}}>Vista operativa: puoi aggiornare soltanto Da finire / Fatto.</p>}
    <BookingForm open={creating||Boolean(editing)} onClose={()=>{setCreating(false);setEditing(null)}} hotel={hotel} user={user} bookings={bookings} rooms={rooms} initial={editing} onSaved={load}/>
    {director&&<RoomConfigSheet open={configOpen} onClose={()=>setConfigOpen(false)} hotel={hotel} rooms={rooms} onSaved={load}/>} 
  </section>
}
