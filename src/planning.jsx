import { useEffect, useState } from 'react'
import { fetchBookings, insertBooking, updateBookingRow, deleteBookingRow, subscribeBookings } from './sale-data.js'

const VIEWS = [['giorno','Giorno',1],['settimana','Settimana',7],['quindicina','Quindicina',15]]
const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const startDay = (value = new Date()) => { const date=new Date(value); date.setHours(0,0,0,0); return date }
const addDays = (date, amount) => { const next=new Date(date); next.setDate(next.getDate()+amount); return next }
const isoDay = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const dayLabel = (date) => `${WD[date.getDay()]} ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`

function CalendarControls({ view, onView, anchor, onAnchor, todayAnchor = startDay }) {
  const days = VIEWS.find(([key]) => key === view)[2]
  const goToday = () => { onView('giorno'); onAnchor(todayAnchor()) }
  return <><div className="calendar-views">{VIEWS.map(([key,label]) => <button key={key} className={view===key?'active':''} onClick={()=>onView(key)}>{label}</button>)}</div><div className="calendar-nav"><button onClick={()=>onAnchor(addDays(anchor,-days))}>‹</button><button className={view==='giorno'?'active':''} onClick={goToday}>Oggi</button><button onClick={()=>onAnchor(addDays(anchor,days))}>›</button></div></>
}

export function PlanningWork({ items, onOpen }) {
  const [view,setView]=useState('giorno')
  const [anchor,setAnchor]=useState(()=>startDay())
  const count=VIEWS.find(([key])=>key===view)[2]
  const days=Array.from({length:count},(_,index)=>addDays(anchor,index))
  return <section className="calendar-page work-calendar"><header><div><h2>Planning lavori</h2><p>Interventi pianificati secondo il periodo Da/A.</p></div><span>{items.filter(item=>item.status!=='done').length} da fare</span></header><CalendarControls view={view} onView={setView} anchor={anchor} onAnchor={setAnchor}/><div className="calendar-days">{days.map((day)=>{const start=startDay(day).getTime(),end=addDays(startDay(day),1).getTime()-1;const entries=items.filter(item=>item.scheduledAt<=end&&(item.scheduledUntil||item.scheduledAt)>=start).sort((a,b)=>a.scheduledAt-b.scheduledAt);return <article key={isoDay(day)}><header><strong>{dayLabel(day)}</strong>{isoDay(day)===isoDay(new Date())&&<span>OGGI</span>}</header>{entries.length?<div>{entries.map(item=><button className={`work-event ${item.status||'pending'}`} key={item.id} onClick={()=>onOpen(item.id)}><strong>{item.location}</strong><span>{item.notes}</span><small>{new Date(item.scheduledAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}–{new Date(item.scheduledUntil||item.scheduledAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · {item.assignees?.map(person=>person.name).join(', ')}</small></button>)}</div>:<p>Nessun intervento</p>}</article>})}</div></section>
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

function SaleBookingForm({ isBusy, onClose, onSave, initial, error }) {
  const [family,setFamily]=useState(()=>FAMILIES.find(item=>item.rooms.includes(initial?.room))?.family||'')
  const today=isoDay(new Date())
  const [draft,setDraft]=useState(()=>initial?{room:initial.room,dateFrom:initial.dateFrom||initial.date,dateTo:initial.dateTo||initial.date,shift:initial.shift,client:initial.client,notes:initial.notes||''}:{room:'',dateFrom:today,dateTo:today,shift:'mattina',client:'',notes:''})
  const familyData=FAMILIES.find(item=>item.family===family)
  const validRange=draft.dateFrom&&draft.dateTo&&draft.dateTo>=draft.dateFrom
  const roomBusy=(room)=>validRange&&isBusy(room,draft.dateFrom,draft.dateTo,draft.shift,initial?.id)
  const occupied=draft.room&&roomBusy(draft.room)
  const valid=draft.room&&validRange&&draft.client.trim()&&!occupied
  const chooseFamily=(item)=>{setFamily(item.family);setDraft({...draft,room:item.rooms.length===1?item.rooms[0]:''})}
  return <div className="urgent-transform-backdrop" onClick={onClose}><form className="sale-form" onClick={event=>event.stopPropagation()} onSubmit={event=>{event.preventDefault();if(valid)onSave({...draft,client:draft.client.trim(),notes:draft.notes.trim()})}}><header><h2>{initial?'Modifica prenotazione':'Nuova prenotazione'}</h2><button type="button" className="panel-close" onClick={onClose}>×</button></header><label>Cliente *<input value={draft.client} onChange={event=>setDraft({...draft,client:event.target.value})} placeholder="Nome cliente/azienda"/></label><div className="sale-date-range"><label>Da *<input type="date" value={draft.dateFrom} onChange={event=>setDraft({...draft,dateFrom:event.target.value,dateTo:draft.dateTo<event.target.value?event.target.value:draft.dateTo})}/></label><label>A *<input type="date" min={draft.dateFrom} value={draft.dateTo} onChange={event=>setDraft({...draft,dateTo:event.target.value})}/></label></div>{!validRange&&<p className="sale-conflict">La data finale deve essere uguale o successiva a quella iniziale.</p>}<fieldset><legend>Turno *</legend><div className="shift-choices">{Object.entries(SHIFT_LABELS).map(([key,label])=><button type="button" key={key} className={`${key} ${draft.shift===key?'active':''}`} onClick={()=>setDraft({...draft,shift:key})}>{label}</button>)}</div></fieldset><fieldset><legend>Disponibilità sale</legend><div className="sale-choices sale-availability">{FAMILIES.map(item=>{const allBusy=item.rooms.every(roomBusy);const someBusy=item.rooms.some(roomBusy);return <button type="button" key={item.family} className={`${family===item.family?'active':''} ${allBusy?'busy':someBusy?'partial':'free'}`} onClick={()=>chooseFamily(item)}><span>{item.family}</span><small>{allBusy?'Occupata':someBusy?'Parziale':'Libera'}</small></button>})}</div></fieldset>{familyData?.rooms.length>1&&<fieldset><legend>Combinazione *</legend><div className="sale-choices sale-availability">{familyData.rooms.map(room=>{const busy=roomBusy(room);return <button type="button" key={room} disabled={busy} className={`${draft.room===room?'active':''} ${busy?'busy':'free'}`} onClick={()=>setDraft({...draft,room})}><span>{room.replace(`${family} `,'')}</span><small>{busy?'Occupata':'Libera'}</small></button>})}</div></fieldset>}{occupied&&<p className="sale-conflict">Sala non disponibile: già occupata o in conflitto con una combinazione nel periodo selezionato.</p>}{error&&<p className="sale-conflict">{error}</p>}<label>Note (opzionale)<textarea rows="3" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label><button className="primary" disabled={!valid}>{initial?'✓ Salva modifiche':'✓ Prenota'}</button></form></div>
}

function SaleBookingDetail({ booking, canMarkStatus, canEdit, onClose, onToFinish, onDone, onDelete, onEdit }) {
  return <div className="urgent-transform-backdrop" onClick={onClose}><section className="planned-detail" onClick={(event) => event.stopPropagation()}><header><button className="back-link" onClick={onClose}>‹ Chiudi</button><div>{canEdit && <button className="planned-edit" onClick={onEdit}>Modifica</button>}{canEdit && <button className="delete-issue-compact" onClick={() => { onDelete(booking); onClose() }}>Elimina</button>}</div></header><h2>{booking.room} · Prenotazione</h2><article><small>DETTAGLI PRENOTAZIONE</small><span className="planned-category">{SHIFT_LABELS[booking.shift]}</span><p><strong>{booking.client}</strong>{booking.notes ? ` · ${booking.notes}` : ''}</p>{booking.status === 'da_finire' && <div className="status-note to-finish">Segnato da finire da <strong>{booking.toFinishBy}</strong> · {new Date(booking.toFinishAt).toLocaleString('it-IT')}</div>}{booking.status === 'done' && <div className="status-note done">Completata da <strong>{booking.doneBy}</strong> · {new Date(booking.doneAt).toLocaleString('it-IT')}</div>}<em>Creato da {booking.createdBy} · {new Date(booking.createdAt).toLocaleString('it-IT')}</em></article><div className="planned-meta-grid"><article className="planned-date"><small>PERIODO</small><div className="planned-date-range"><span><i>DA</i><strong>{booking.dateFrom || booking.date}</strong></span><span><i>A</i><strong>{booking.dateTo || booking.date}</strong></span></div></article></div>{canMarkStatus && booking.status !== 'done' && <div className="planned-actions"><button className="secondary to-finish-action" onClick={() => { onToFinish(booking); onClose() }}>◐ Segna da finire</button><button className="planned-complete" onClick={() => { onDone(booking); onClose() }}>✓ Fatto</button></div>}</section></div>
}

export function PlanningSale({ hotel, user, openRequest }) {
  const isPaolo=String(user?.name||'').trim().toLowerCase()==='paolo'
  const isMaintenance=String(user?.role||'').trim().toLowerCase()==='manutentore'
  const canEdit=isPaolo
  const canMarkStatus=isPaolo||isMaintenance
  const [bookings,setBookings]=useState([])
  const [view,setView]=useState('giorno')
  const [anchor,setAnchor]=useState(()=>startDay())
  const [creating,setCreating]=useState(false)
  const [openBookingId,setOpenBookingId]=useState(null)
  const [editingBookingId,setEditingBookingId]=useState(null)
  const [saveError,setSaveError]=useState('')
  const refresh=async()=>{const {items}=await fetchBookings(hotel.id);setBookings(items)}
  useEffect(()=>{refresh();const unsub=subscribeBookings(hotel.id,refresh);return unsub},[hotel.id])
  useEffect(()=>{if(openRequest&&canEdit)setCreating(true)},[openRequest,canEdit])
  const count=VIEWS.find(([key])=>key===view)[2]
  const days=Array.from({length:count},(_,index)=>addDays(anchor,index))
  const isBusy=(room,dateFrom,dateTo,shift,excludeId)=>bookings.filter(item=>item.id!==excludeId).filter(item=>{const itemFrom=item.dateFrom||item.date;const itemTo=item.dateTo||item.date;return itemFrom<=dateTo&&itemTo>=dateFrom&&(item.room===room||saleConflict(item.room,room))}).some(item=>shift==='tutto_giorno'||item.shift==='tutto_giorno'||item.shift===shift)
  const save=async draft=>{if(!canEdit)return;setSaveError('');try{if(editingBookingId){if(isBusy(draft.room,draft.dateFrom,draft.dateTo,draft.shift,editingBookingId))return;await updateBookingRow(editingBookingId,draft);setEditingBookingId(null)}else{if(isBusy(draft.room,draft.dateFrom,draft.dateTo,draft.shift))return;await insertBooking({...draft,hotelId:hotel.id,status:'pending',createdBy:user.name})}setCreating(false)}catch(error){setSaveError(error?.message||'Salvataggio non riuscito, riprova')}}
  const remove=async booking=>{if(canEdit&&window.confirm(`Eliminare la prenotazione di “${booking.client}”?`))await deleteBookingRow(booking.id)}
  const markToFinish=async booking=>{if(canMarkStatus)await updateBookingRow(booking.id,{status:'da_finire',toFinishBy:user.name,toFinishAt:Date.now()})}
  const markDone=async booking=>{if(canMarkStatus)await updateBookingRow(booking.id,{status:'done',doneBy:user.name,doneAt:Date.now()})}
  const openBooking=bookings.find(item=>item.id===openBookingId)||null
  const editingBooking=bookings.find(item=>item.id===editingBookingId)||null
  const today=isoDay(new Date())
  const todayItems=bookings.filter(item=>(item.dateFrom||item.date)<=today&&(item.dateTo||item.date)>=today)
  const toFinish=bookings.filter(item=>item.status==='da_finire').length
  const doneToday=todayItems.filter(item=>item.status==='done').length
  return <section className="calendar-page sale-calendar"><header><div><h2>Planning Sale</h2><p>Preparazione operativa delle sale.</p></div>{canEdit?<button type="button" className="planning-sale-new" onClick={()=>setCreating(true)}>+ Nuova prenotazione</button>:<span>Aggiorna lo stato dei lavori</span>}</header><div className="planning-sale-summary"><span><b>{todayItems.length}</b> Oggi</span><span><b>{toFinish}</b> Da finire</span><span><b>{doneToday}</b> Fatti oggi</span></div><CalendarControls view={view} onView={setView} anchor={anchor} onAnchor={setAnchor}/><div className="shift-legend">{Object.entries(SHIFT_LABELS).map(([key,label])=><span key={key} className={key}><i/>{label}</span>)}</div><div className="calendar-days">{days.map(day=>{const date=isoDay(day);const entries=bookings.filter(item=>(item.dateFrom||item.date)<=date&&(item.dateTo||item.date)>=date).sort((a,b)=>SALE_DEF.findIndex(([room])=>room===a.room)-SALE_DEF.findIndex(([room])=>room===b.room));return <article key={date}><header><strong>{dayLabel(day)}</strong>{date===today&&<span>OGGI</span>}</header>{entries.length?<div>{entries.map(item=><button type="button" className={`sale-event ${item.shift} ${item.status||'pending'}`} key={item.id} onClick={()=>setOpenBookingId(item.id)}><div><strong>{item.room}</strong><span>{item.client}{item.notes?` · ${item.notes}`:''}</span>{item.status==='da_finire'&&<small className="sale-status-note">Da finire · {item.toFinishBy}</small>}{item.status==='done'&&<small className="sale-status-note">✓ Fatto · {item.doneBy}</small>}</div><small>{SHIFT_LABELS[item.shift]} · {item.dateFrom||item.date} → {item.dateTo||item.date}</small><span className="sale-event-arrow" aria-hidden="true">›</span></button>)}</div>:<p>Nessuna prenotazione</p>}</article>})}</div>{canEdit&&(creating||editingBooking)&&<SaleBookingForm isBusy={isBusy} initial={editingBooking} error={saveError} onClose={()=>{setCreating(false);setEditingBookingId(null);setSaveError('')}} onSave={save}/>}{openBooking&&<SaleBookingDetail booking={openBooking} canMarkStatus={canMarkStatus} canEdit={canEdit} onClose={()=>setOpenBookingId(null)} onToFinish={markToFinish} onDone={markDone} onDelete={remove} onEdit={()=>{setEditingBookingId(openBooking.id);setOpenBookingId(null)}}/>}</section>
}
