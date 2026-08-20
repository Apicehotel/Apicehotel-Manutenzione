import { useEffect, useMemo, useState } from 'react'

const VIEWS = [['giorno','Giorno',1],['settimana','Settimana',7],['quindicina','Quindicina',15]]
const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const startDay = (value = new Date()) => { const date=new Date(value); date.setHours(0,0,0,0); return date }
const addDays = (date, amount) => { const next=new Date(date); next.setDate(next.getDate()+amount); return next }
const isoDay = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const dayLabel = (date) => `${WD[date.getDay()]} ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`

function CalendarControls({ view, onView, anchor, onAnchor }) {
  const days = VIEWS.find(([key]) => key === view)[2]
  return <><div className="calendar-views">{VIEWS.map(([key,label]) => <button key={key} className={view===key?'active':''} onClick={()=>onView(key)}>{label}</button>)}</div><div className="calendar-nav"><button onClick={()=>onAnchor(addDays(anchor,-days))}>‹</button><button onClick={()=>onAnchor(startDay())}>Oggi</button><button onClick={()=>onAnchor(addDays(anchor,days))}>›</button></div></>
}

export function PlanningWork({ items, onOpen }) {
  const [view,setView]=useState('settimana')
  const [anchor,setAnchor]=useState(()=>startDay())
  const count=VIEWS.find(([key])=>key===view)[2]
  const days=Array.from({length:count},(_,index)=>addDays(anchor,index))
  return <section className="calendar-page work-calendar"><header><div><h2>Planning lavori</h2><p>Interventi pianificati secondo il periodo Da/A.</p></div><span>{items.filter(item=>item.status!=='done').length} da fare</span></header><CalendarControls view={view} onView={setView} anchor={anchor} onAnchor={setAnchor}/><div className="calendar-days">{days.map((day)=>{const start=startDay(day).getTime(),end=addDays(startDay(day),1).getTime()-1;const entries=items.filter(item=>item.status!=='done'&&item.scheduledAt<=end&&(item.scheduledUntil||item.scheduledAt)>=start).sort((a,b)=>a.scheduledAt-b.scheduledAt);return <article key={isoDay(day)}><header><strong>{dayLabel(day)}</strong>{isoDay(day)===isoDay(new Date())&&<span>OGGI</span>}</header>{entries.length?<div>{entries.map(item=><button className={`work-event ${item.status}`} key={item.id} onClick={()=>onOpen(item.id)}><strong>{item.location}</strong><span>{item.notes}</span><small>{new Date(item.scheduledAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}–{new Date(item.scheduledUntil||item.scheduledAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · {item.assignees?.map(person=>person.name).join(', ')}</small></button>)}</div>:<p>Nessun intervento</p>}</article>})}</div></section>
}

const SALE_DEF = [
  ['Guitar',['guitar']],['Drums',['drums']],['Room',['room']],['Preservation',['preservation']],['Cool',['cool']],
  ['Trumpet 1',['t1']],['Trumpet 2',['t2']],['Trumpet 3',['t3']],['Trumpet 4',['t4']],['Trumpet 1+2',['t1','t2']],['Trumpet 2+3',['t2','t3']],['Trumpet 3+4',['t3','t4']],['Trumpet 1+2+3',['t1','t2','t3']],['Trumpet 2+3+4',['t2','t3','t4']],['Trumpet 1+2+3+4',['t1','t2','t3','t4']],
  ['Sax 1',['s1']],['Sax 2',['s2']],['Sax 3',['s3']],['Sax 1+2',['s1','s2']],['Sax 2+3',['s2','s3']],['Sax 1+2+3',['s1','s2','s3']],
  ['Auditorium Intero',['auditorium-tower-1','auditorium-tower-2']],['Auditorium Tower 1',['auditorium-tower-1']],['Auditorium Tower 2',['auditorium-tower-2']],['Cantina',['cantina']],['Gusto',['gusto']],['Cravatte',['cravatte']],['Sala delle Feste',['feste']],
]
const SALE_PARTS=Object.fromEntries(SALE_DEF)
const saleConflict=(first,second)=>(SALE_PARTS[first]||[]).some(part=>(SALE_PARTS[second]||[]).includes(part))
const FAMILIES=(()=>{const map=new Map();for(const [room] of SALE_DEF){const family=room.startsWith('Trumpet')?'Trumpet':room.startsWith('Sax')?'Sax':room.startsWith('Auditorium')?'Auditorium':room;if(!map.has(family))map.set(family,[]);map.get(family).push(room)}return [...map].map(([family,rooms])=>({family,rooms}))})()
const SHIFT_LABELS={mattina:'Mattina',pomeriggio:'Pomeriggio',tutto_giorno:'Giornata intera'}
const SALE_KEY='apicehotel.sale-bookings.v1'
const loadBookings=()=>{try{const value=JSON.parse(localStorage.getItem(SALE_KEY));return Array.isArray(value)?value:[]}catch{return[]}}

function SaleBookingForm({ isBusy, onClose, onSave }) {
  const [family,setFamily]=useState('')
  const today=isoDay(new Date())
  const [draft,setDraft]=useState({room:'',dateFrom:today,dateTo:today,shift:'mattina',client:'',notes:''})
  const familyData=FAMILIES.find(item=>item.family===family)
  const validRange=draft.dateFrom&&draft.dateTo&&draft.dateTo>=draft.dateFrom
  const occupied=draft.room&&validRange&&isBusy(draft.room,draft.dateFrom,draft.dateTo,draft.shift)
  const valid=draft.room&&validRange&&draft.client.trim()&&!occupied
  const chooseFamily=(item)=>{setFamily(item.family);setDraft({...draft,room:item.rooms.length===1?item.rooms[0]:''})}
  return <div className="urgent-transform-backdrop" onClick={onClose}><form className="sale-form" onClick={event=>event.stopPropagation()} onSubmit={event=>{event.preventDefault();if(valid)onSave({...draft,client:draft.client.trim(),notes:draft.notes.trim()})}}><header><h2>Nuova prenotazione</h2><button type="button" className="panel-close" onClick={onClose}>×</button></header><fieldset><legend>Sala *</legend><div className="sale-choices">{FAMILIES.map(item=><button type="button" key={item.family} className={family===item.family?'active':''} onClick={()=>chooseFamily(item)}>{item.family}</button>)}</div></fieldset>{familyData?.rooms.length>1&&<fieldset><legend>Combinazione *</legend><div className="sale-choices">{familyData.rooms.map(room=><button type="button" key={room} className={draft.room===room?'active':''} onClick={()=>setDraft({...draft,room})}>{room.replace(`${family} `,'')}</button>)}</div></fieldset>}<div className="sale-date-range"><label>Da *<input type="date" value={draft.dateFrom} onChange={event=>setDraft({...draft,dateFrom:event.target.value,dateTo:draft.dateTo<event.target.value?event.target.value:draft.dateTo})}/></label><label>A *<input type="date" min={draft.dateFrom} value={draft.dateTo} onChange={event=>setDraft({...draft,dateTo:event.target.value})}/></label></div>{!validRange&&<p className="sale-conflict">La data finale deve essere uguale o successiva a quella iniziale.</p>}<fieldset><legend>Turno *</legend><div className="shift-choices">{Object.entries(SHIFT_LABELS).map(([key,label])=><button type="button" key={key} className={`${key} ${draft.shift===key?'active':''}`} onClick={()=>setDraft({...draft,shift:key})}>{label}</button>)}</div></fieldset>{occupied&&<p className="sale-conflict">Sala non disponibile: già occupata o in conflitto con una combinazione nel periodo selezionato.</p>}<label>Cliente *<input value={draft.client} onChange={event=>setDraft({...draft,client:event.target.value})} placeholder="Nome cliente/azienda"/></label><label>Note (opzionale)<textarea rows="3" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label><button className="primary" disabled={!valid}>✓ Prenota</button></form></div>
}

export function PlanningSale({ user, openRequest }) {
  const canEdit=['admin','Responsabile','Direttore Centro Congressi'].includes(user.role)
  const [bookings,setBookings]=useState(loadBookings)
  const [view,setView]=useState('settimana')
  const [anchor,setAnchor]=useState(()=>startDay())
  const [creating,setCreating]=useState(false)
  useEffect(()=>{if(openRequest)setCreating(true)},[openRequest])
  const count=VIEWS.find(([key])=>key===view)[2]
  const days=Array.from({length:count},(_,index)=>addDays(anchor,index))
  const persist=next=>{localStorage.setItem(SALE_KEY,JSON.stringify(next));setBookings(next)}
  const isBusy=(room,dateFrom,dateTo,shift)=>bookings.filter(item=>{const itemFrom=item.dateFrom||item.date;const itemTo=item.dateTo||item.date;return itemFrom<=dateTo&&itemTo>=dateFrom&&(item.room===room||saleConflict(item.room,room))}).some(item=>shift==='tutto_giorno'||item.shift==='tutto_giorno'||item.shift===shift)
  const save=draft=>{if(isBusy(draft.room,draft.dateFrom,draft.dateTo,draft.shift))return;persist([{...draft,id:Date.now(),createdBy:user.name,createdAt:Date.now()},...bookings]);setCreating(false)}
  const remove=booking=>{if(canEdit&&window.confirm(`Eliminare la prenotazione di “${booking.client}”?`))persist(bookings.filter(item=>item.id!==booking.id))}
  return <section className="calendar-page sale-calendar"><header><div><h2>Planning Sale</h2><p>Prenotazioni sale sempre definite con periodo Da/A.</p></div>{!canEdit&&<span>Sola visualizzazione</span>}</header><CalendarControls view={view} onView={setView} anchor={anchor} onAnchor={setAnchor}/><div className="shift-legend">{Object.entries(SHIFT_LABELS).map(([key,label])=><span key={key} className={key}><i/>{label}</span>)}</div><div className="calendar-days">{days.map(day=>{const date=isoDay(day);const entries=bookings.filter(item=>(item.dateFrom||item.date)<=date&&(item.dateTo||item.date)>=date).sort((a,b)=>SALE_DEF.findIndex(([room])=>room===a.room)-SALE_DEF.findIndex(([room])=>room===b.room));return <article key={date}><header><strong>{dayLabel(day)}</strong>{date===isoDay(new Date())&&<span>OGGI</span>}</header>{entries.length?<div>{entries.map(item=><div className={`sale-event ${item.shift}`} key={item.id}><div><strong>{item.room}</strong><span>{item.client}{item.notes?` · ${item.notes}`:''}</span></div><small>{SHIFT_LABELS[item.shift]} · {item.dateFrom||item.date} → {item.dateTo||item.date}</small>{canEdit&&<button onClick={()=>remove(item)} aria-label={`Elimina ${item.client}`}>×</button>}</div>)}</div>:<p>Nessuna prenotazione</p>}</article>})}</div>{creating&&<SaleBookingForm isBusy={isBusy} onClose={()=>setCreating(false)} onSave={save}/>}</section>
}
