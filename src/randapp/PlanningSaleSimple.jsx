import { useEffect, useMemo, useState } from 'react'
import { deleteBookingRow, fetchBookings, insertBooking, subscribeBookings, updateBookingRow } from '../sale-data.js'
import { Button, Icon, Sheet } from './ui.jsx'

const SALE_DEF = [
  ['Guitar',['guitar']],['Drums',['drums']],['Room',['room']],['Preservation',['preservation']],['Cool',['cool']],
  ['Trumpet 1',['t1']],['Trumpet 2',['t2']],['Trumpet 3',['t3']],['Trumpet 4',['t4']],['Trumpet 1+2',['t1','t2']],['Trumpet 2+3',['t2','t3']],['Trumpet 3+4',['t3','t4']],['Trumpet 1+2+3',['t1','t2','t3']],['Trumpet 2+3+4',['t2','t3','t4']],['Trumpet 1+2+3+4',['t1','t2','t3','t4']],
  ['Sax 1',['s1']],['Sax 2',['s2']],['Sax 3',['s3']],['Sax 1+2',['s1','s2']],['Sax 2+3',['s2','s3']],['Sax 1+2+3',['s1','s2','s3']],
  ['Auditorium Intero',['auditorium-tower-1','auditorium-tower-2']],['Auditorium Tower 1',['auditorium-tower-1']],['Auditorium Tower 2',['auditorium-tower-2']],['Cantina',['cantina']],['Gusto',['gusto']],['Cravatte',['cravatte']],['Sala delle Feste',['feste']],
]
const PARTS = Object.fromEntries(SALE_DEF)
const SHIFTS = { mattina:'Mattina', pomeriggio:'Pomeriggio', tutto_giorno:'Giornata intera' }
const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const iso = (value = new Date()) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const addDays = (value,n) => { const d=new Date(value); d.setDate(d.getDate()+n); return d }
const dayLabel = (value) => `${WD[value.getDay()]} ${String(value.getDate()).padStart(2,'0')}/${String(value.getMonth()+1).padStart(2,'0')}`
const overlaps = (aFrom,aTo,bFrom,bTo) => aFrom<=bTo && aTo>=bFrom
const conflicts = (a,b) => (PARTS[a]||[]).some((part)=>(PARTS[b]||[]).includes(part))
const normalize = (value='') => String(value).trim().toLocaleLowerCase('it')
const isPaolo = (user) => user?.auth_user_id === 'ebf6f85d-8b08-41af-8604-df7d908ff68b' || normalize(user?.name) === 'paolo'
const isMaintainer = (user) => normalize(user?.role) === 'manutentore'

function roomAvailability(room, dateFrom, dateTo, shift, bookings, excludeId=null) {
  const rows = bookings.filter((item)=>item.id!==excludeId && overlaps(item.dateFrom||item.date,item.dateTo||item.date,dateFrom,dateTo) && (item.room===room || conflicts(item.room,room)))
  const morning = rows.some((item)=>item.shift==='mattina'||item.shift==='tutto_giorno')
  const afternoon = rows.some((item)=>item.shift==='pomeriggio'||item.shift==='tutto_giorno')
  if (shift==='mattina') return morning ? 'busy' : 'free'
  if (shift==='pomeriggio') return afternoon ? 'busy' : 'free'
  if (morning && afternoon) return 'busy'
  if (morning || afternoon) return 'partial'
  return 'free'
}

function Metric({value,label,tone='normal'}) {
  const color=tone==='done'?'var(--rs-ok)':tone==='finish'?'var(--rs-warn)':'var(--rs-text)'
  return <div style={{border:'1px solid var(--rs-line)',borderRadius:14,padding:'10px 8px',background:'var(--rs-surface)',textAlign:'center'}}><b style={{display:'block',fontFamily:'Sora',fontSize:'1.15rem',color}}>{value}</b><small style={{color:'var(--rs-text-3)'}}>{label}</small></div>
}

function BookingForm({ open, onClose, hotel, user, bookings, initial, onSaved }) {
  const today=iso()
  const [draft,setDraft]=useState({client:'',dateFrom:today,dateTo:today,shift:'mattina',room:'',notes:''})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!open)return
    setDraft(initial?{client:initial.client||'',dateFrom:initial.dateFrom||initial.date||today,dateTo:initial.dateTo||initial.date||today,shift:initial.shift||'mattina',room:initial.room||'',notes:initial.notes||''}:{client:'',dateFrom:today,dateTo:today,shift:'mattina',room:'',notes:''})
    setError('')
  },[open,initial,today])

  const clientNames=useMemo(()=>[...new Set(bookings.map((b)=>b.client).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')),[bookings])
  const usualRoom=useMemo(()=>{
    const key=normalize(draft.client)
    if(!key)return null
    const history=bookings.filter((b)=>normalize(b.client)===key && b.room)
    if(!history.length)return null
    const counts=new Map(); history.forEach((b)=>counts.set(b.room,(counts.get(b.room)||0)+1))
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null
  },[draft.client,bookings])

  const statusFor=(room)=>roomAvailability(room,draft.dateFrom,draft.dateTo,draft.shift,bookings,initial?.id)
  const selectedStatus=draft.room?statusFor(draft.room):null
  const canSave=draft.client.trim()&&draft.room&&draft.dateFrom&&draft.dateTo>=draft.dateFrom&&selectedStatus==='free'

  const save=async(e)=>{
    e.preventDefault(); if(!canSave||saving)return
    setSaving(true); setError('')
    try{
      const payload={room:draft.room,dateFrom:draft.dateFrom,dateTo:draft.dateTo,shift:draft.shift,client:draft.client.trim(),notes:draft.notes.trim(),hotelId:hotel.id}
      if(initial) await updateBookingRow(initial.id,payload)
      else await insertBooking({...payload,status:'pending',createdBy:user.name,createdAt:Date.now()})
      await onSaved?.(); onClose?.()
    }catch(err){setError(err?.message||'Salvataggio non riuscito')}
    finally{setSaving(false)}
  }

  return <Sheet open={open} onClose={onClose} className="rs-sale-sheet">
    <form onSubmit={save} style={{display:'grid',gap:16}}>
      <header style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className="rs-btn rs-btn--ghost" onClick={onClose}>‹</button><div><h2 style={{margin:0,fontFamily:'Sora'}}>{initial?'Modifica prenotazione':'Nuova prenotazione'}</h2><small style={{color:'var(--rs-text-3)'}}>Prima periodo e turno, poi scegli una sala disponibile.</small></div></header>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
        <label className="rs-field"><span className="rs-field__label">Da *</span><input type="date" value={draft.dateFrom} onChange={(e)=>setDraft((d)=>({...d,dateFrom:e.target.value,dateTo:d.dateTo<e.target.value?e.target.value:d.dateTo,room:''}))}/></label>
        <label className="rs-field"><span className="rs-field__label">A *</span><input type="date" min={draft.dateFrom} value={draft.dateTo} onChange={(e)=>setDraft((d)=>({...d,dateTo:e.target.value,room:''}))}/></label>
      </div>
      <fieldset style={{border:0,padding:0,margin:0,display:'grid',gap:8}}><legend style={{fontWeight:800}}>Turno *</legend><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>{Object.entries(SHIFTS).map(([key,label])=><button type="button" key={key} className={`rs-btn ${draft.shift===key?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setDraft((d)=>({...d,shift:key,room:''}))}>{label}</button>)}</div></fieldset>
      <label className="rs-field"><span className="rs-field__label">Cliente *</span><input list="sale-client-list" value={draft.client} onChange={(e)=>setDraft((d)=>({...d,client:e.target.value}))} placeholder="Nome cliente / azienda"/><datalist id="sale-client-list">{clientNames.map((name)=><option value={name} key={name}/>)}</datalist></label>
      {usualRoom&&<button type="button" onClick={()=>statusFor(usualRoom)==='free'&&setDraft((d)=>({...d,room:usualRoom}))} style={{border:'1px solid var(--rs-line)',borderRadius:14,padding:12,background:'var(--rs-surface-2)',textAlign:'left',color:'var(--rs-text)'}}><strong>Sala abituale: {usualRoom}</strong><small style={{display:'block',marginTop:3,color:statusFor(usualRoom)==='free'?'var(--rs-ok)':'var(--rs-warn)'}}>{statusFor(usualRoom)==='free'?'Disponibile · tocca per selezionare':statusFor(usualRoom)==='partial'?'Disponibilità parziale':'Occupata nel periodo scelto'}</small></button>}
      <section style={{display:'grid',gap:9}}><div style={{display:'flex',alignItems:'center',gap:8}}><strong>Disponibilità sale</strong><span style={{marginLeft:'auto',fontSize:'.72rem',color:'var(--rs-text-3)'}}>● libera · ◐ parziale · ● occupata</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>{SALE_DEF.map(([room])=>{const status=statusFor(room);const active=draft.room===room;const color=status==='free'?'var(--rs-ok)':status==='partial'?'var(--rs-warn)':'#e35d6a';return <button type="button" key={room} disabled={status!=='free'} onClick={()=>setDraft((d)=>({...d,room}))} style={{minHeight:58,border:`1px solid ${active?'var(--rs-cyan)':'var(--rs-line)'}`,borderRadius:14,padding:'9px 10px',background:active?'color-mix(in srgb,var(--rs-cyan) 12%,var(--rs-surface))':'var(--rs-surface)',textAlign:'left',opacity:status==='busy'?0.6:1,color:'var(--rs-text)'}}><strong style={{display:'block',fontSize:'.85rem'}}>{room}</strong><small style={{color}}>{status==='free'?'● Disponibile':status==='partial'?'◐ Parziale':'● Occupata'}</small></button>})}</div></section>
      <label className="rs-field"><span className="rs-field__label">Note</span><textarea className="rs-textarea" rows="3" value={draft.notes} onChange={(e)=>setDraft((d)=>({...d,notes:e.target.value}))} placeholder="Allestimento, persone, richieste..."/></label>
      {error&&<p style={{margin:0,color:'#e35d6a'}}>{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={!canSave||saving}>{saving?'Salvataggio…':initial?'✓ Salva modifiche':'✓ Prenota'}</Button>
    </form>
  </Sheet>
}

function BookingCard({booking,user,onRefresh,onEdit}) {
  const paolo=isPaolo(user), maintainer=isMaintainer(user)
  const canStatus=paolo||maintainer
  const done=booking.status==='done', finish=booking.status==='da_finire'
  const setStatus=async(status)=>{
    const patch=status==='done'?{status:'done',doneBy:user.name,doneAt:Date.now(),toFinishBy:booking.toFinishBy||null,toFinishAt:booking.toFinishAt||null}:{status:'da_finire',toFinishBy:user.name,toFinishAt:Date.now(),doneBy:null,doneAt:null}
    await updateBookingRow(booking.id,{...patch,hotelId:booking.hotelId}); await onRefresh()
  }
  return <article style={{border:`1px solid ${done?'color-mix(in srgb,var(--rs-ok) 45%,var(--rs-line))':finish?'color-mix(in srgb,var(--rs-warn) 45%,var(--rs-line))':'var(--rs-line)'}`,background:'var(--rs-surface)',borderRadius:16,padding:12,display:'grid',gap:9}}>
    <div style={{display:'flex',alignItems:'flex-start',gap:10}}><div style={{width:10,height:10,borderRadius:99,marginTop:6,background:done?'var(--rs-ok)':finish?'var(--rs-warn)':'var(--rs-text-3)'}}/><div style={{minWidth:0,flex:1}}><strong style={{display:'block'}}>{booking.room}</strong><span style={{display:'block',color:'var(--rs-text-2)',marginTop:2}}>{booking.client}</span><small style={{display:'block',color:'var(--rs-text-3)',marginTop:4}}>{SHIFTS[booking.shift]} · {booking.dateFrom||booking.date}{(booking.dateTo||booking.date)!==(booking.dateFrom||booking.date)?` → ${booking.dateTo}`:''}</small>{booking.notes&&<small style={{display:'block',marginTop:5,color:'var(--rs-text-2)'}}>{booking.notes}</small>}{finish&&<small style={{display:'block',marginTop:6,color:'var(--rs-warn)',fontWeight:800}}>Da finire · {booking.toFinishBy}{booking.toFinishAt?` · ${new Date(booking.toFinishAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}{done&&<small style={{display:'block',marginTop:6,color:'var(--rs-ok)',fontWeight:800}}>✓ Fatto da {booking.doneBy}{booking.doneAt?` · ${new Date(booking.doneAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}</div>{paolo&&<button type="button" className="rs-btn rs-btn--ghost" onClick={()=>onEdit(booking)}><Icon name="edit"/></button>}</div>
    {canStatus&&!done&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setStatus('da_finire')}>◐ Da finire</button><button type="button" className="rs-btn rs-btn--primary" onClick={()=>setStatus('done')}>✓ Fatto</button></div>}
  </article>
}

export default function PlanningSaleSimple({hotel,user,openRequest=0}) {
  const [bookings,setBookings]=useState([])
  const [anchor,setAnchor]=useState(()=>new Date())
  const [view,setView]=useState('giorno')
  const [creating,setCreating]=useState(false)
  const [editing,setEditing]=useState(null)
  const paolo=isPaolo(user)
  const load=async()=>{const result=await fetchBookings(hotel.id);setBookings(result.items||[])}
  useEffect(()=>{load();const off=subscribeBookings(hotel.id,load);return off},[hotel.id])
  useEffect(()=>{if(openRequest&&paolo)setCreating(true)},[openRequest,paolo])
  const count=view==='giorno'?1:7
  const days=useMemo(()=>Array.from({length:count},(_,i)=>addDays(anchor,i)),[anchor,count])
  const today=iso()
  const todayRows=bookings.filter((b)=>(b.dateFrom||b.date)<=today&&(b.dateTo||b.date)>=today)
  const stats={today:todayRows.filter((b)=>b.status!=='done').length,finish:todayRows.filter((b)=>b.status==='da_finire').length,done:todayRows.filter((b)=>b.status==='done').length}
  const shiftAnchor=(n)=>setAnchor((d)=>addDays(d,n))
  const remove=async(booking)=>{if(!paolo||!window.confirm(`Eliminare la prenotazione di “${booking.client}”?`))return;await deleteBookingRow(booking.id,hotel.id);await load()}

  return <section style={{display:'grid',gap:14}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}><Metric value={stats.today} label="Oggi"/><Metric value={stats.finish} label="Da finire" tone="finish"/><Metric value={stats.done} label="Fatti oggi" tone="done"/></div>
    <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,flex:1}}><button type="button" className={`rs-btn ${view==='giorno'?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setView('giorno')}>Giorno</button><button type="button" className={`rs-btn ${view==='settimana'?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setView('settimana')}>Settimana</button></div>{paolo&&<Button variant="primary" onClick={()=>setCreating(true)}>＋ Nuova prenotazione</Button>}</div>
    <div style={{display:'grid',gridTemplateColumns:'48px 1fr 48px',gap:8,alignItems:'center'}}><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>shiftAnchor(view==='giorno'?-1:-7)}>‹</button><div style={{textAlign:'center',fontWeight:800}}>{view==='giorno'?dayLabel(anchor):`${dayLabel(days[0])} – ${dayLabel(days[days.length-1])}`}</div><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>shiftAnchor(view==='giorno'?1:7)}>›</button></div>
    <button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(new Date())}>Oggi</button>
    <div style={{display:'grid',gap:14}}>{days.map((day)=>{const date=iso(day);const list=bookings.filter((b)=>(b.dateFrom||b.date)<=date&&(b.dateTo||b.date)>=date);return <section key={date} style={{display:'grid',gap:9}}><h3 style={{margin:'5px 0 0',fontFamily:'Sora',color:date===today?'var(--rs-ok)':'var(--rs-text)'}}>{dayLabel(day)}{date===today?' · oggi':''}</h3>{list.length?list.map((booking)=><div key={booking.id} style={{display:'grid',gap:6}}><BookingCard booking={booking} user={user} onRefresh={load} onEdit={setEditing}/>{paolo&&<button type="button" onClick={()=>remove(booking)} style={{justifySelf:'end',border:0,background:'transparent',color:'#e35d6a',fontSize:'.72rem'}}>Elimina</button>}</div>):<p style={{margin:0,color:'var(--rs-text-3)'}}>Nessuna prenotazione.</p>}</section>})}</div>
    {!paolo&&<p style={{margin:0,color:'var(--rs-text-3)',fontSize:'.78rem'}}>Visualizzazione operativa: puoi aggiornare solo lo stato Da finire / Fatto.</p>}
    <BookingForm open={creating||Boolean(editing)} onClose={()=>{setCreating(false);setEditing(null)}} hotel={hotel} user={user} bookings={bookings} initial={editing} onSaved={load}/>
  </section>
}
