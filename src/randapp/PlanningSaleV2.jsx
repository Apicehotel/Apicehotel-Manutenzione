import { useEffect, useMemo, useState } from 'react'
import { deleteBookingRow, fetchBookings, insertBooking, subscribeBookings, updateBookingRow } from '../sale-data.js'
import { Button, Icon, Sheet } from './ui.jsx'

const PAOLO_AUTH_USER_ID = 'ebf6f85d-8b08-41af-8604-df7d908ff68b'
const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const SHIFTS = [
  ['mattina','Mattina'],
  ['pomeriggio','Pomeriggio'],
  ['tutto_giorno','Giornata intera'],
]
const SHIFT_LABEL = Object.fromEntries(SHIFTS)
const SALE_DEF = [
  ['Guitar',['guitar']],['Drums',['drums']],['Room',['room']],['Preservation',['preservation']],['Cool',['cool']],
  ['Trumpet 1',['t1']],['Trumpet 2',['t2']],['Trumpet 3',['t3']],['Trumpet 4',['t4']],['Trumpet 1+2',['t1','t2']],['Trumpet 2+3',['t2','t3']],['Trumpet 3+4',['t3','t4']],['Trumpet 1+2+3',['t1','t2','t3']],['Trumpet 2+3+4',['t2','t3','t4']],['Trumpet 1+2+3+4',['t1','t2','t3','t4']],
  ['Sax 1',['s1']],['Sax 2',['s2']],['Sax 3',['s3']],['Sax 1+2',['s1','s2']],['Sax 2+3',['s2','s3']],['Sax 1+2+3',['s1','s2','s3']],
  ['Auditorium Intero',['auditorium-tower-1','auditorium-tower-2']],['Auditorium Tower 1',['auditorium-tower-1']],['Auditorium Tower 2',['auditorium-tower-2']],['Cantina',['cantina']],['Gusto',['gusto']],['Cravatte',['cravatte']],['Sala delle Feste',['feste']],
]
const PARTS = Object.fromEntries(SALE_DEF)
const FAMILIES = (() => {
  const map = new Map()
  for (const [room] of SALE_DEF) {
    const family = room.startsWith('Trumpet') ? 'Trumpet' : room.startsWith('Sax') ? 'Sax' : room.startsWith('Auditorium') ? 'Auditorium' : room
    if (!map.has(family)) map.set(family, [])
    map.get(family).push(room)
  }
  return [...map].map(([family, rooms]) => ({ family, rooms }))
})()

const startDay = (value = new Date()) => { const d = new Date(value); d.setHours(0,0,0,0); return d }
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate()+n); return d }
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const label = (date) => `${WD[date.getDay()]} ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`
const overlaps = (aFrom,aTo,bFrom,bTo) => aFrom <= bTo && aTo >= bFrom
const conflicts = (a,b) => (PARTS[a] || []).some((part) => (PARTS[b] || []).includes(part))
const shiftConflicts = (a,b) => a === 'tutto_giorno' || b === 'tutto_giorno' || a === b
const norm = (value) => String(value || '').trim().toLowerCase()

function isPaolo(user) {
  return user?.auth_user_id === PAOLO_AUTH_USER_ID || norm(user?.name) === 'paolo'
}
function isMaintainer(user) {
  return ['manutentore','manutentori','maintenance'].includes(norm(user?.role))
}

function availabilityFor(room, draft, bookings, excludeId = null) {
  if (!draft.dateFrom || !draft.dateTo || !draft.shift) return { state:'unknown', label:'Scegli periodo' }
  const hits = bookings.filter((item) => item.id !== excludeId)
    .filter((item) => overlaps(item.dateFrom || item.date, item.dateTo || item.date, draft.dateFrom, draft.dateTo))
    .filter((item) => conflicts(item.room, room))
  if (!hits.length) return { state:'free', label:'Libera' }
  if (hits.some((item) => shiftConflicts(item.shift, draft.shift))) return { state:'busy', label:'Occupata' }
  return { state:'partial', label:'Parziale' }
}

function favoriteRoom(client, bookings) {
  const target = norm(client)
  if (!target) return null
  const counts = new Map()
  bookings.filter((item) => norm(item.client) === target).forEach((item) => counts.set(item.room, (counts.get(item.room) || 0) + 1))
  return [...counts.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] || null
}

function BookingSheet({ open, onClose, hotel, user, bookings, initial = null, onSaved }) {
  const today = iso(new Date())
  const [draft,setDraft] = useState({client:'',dateFrom:today,dateTo:today,shift:'mattina',room:'',notes:''})
  const [family,setFamily] = useState('')
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')

  useEffect(() => {
    if (!open) return
    const next = initial
      ? {client:initial.client || '',dateFrom:initial.dateFrom || initial.date || today,dateTo:initial.dateTo || initial.date || today,shift:initial.shift || 'mattina',room:initial.room || '',notes:initial.notes || ''}
      : {client:'',dateFrom:today,dateTo:today,shift:'mattina',room:'',notes:''}
    setDraft(next)
    setFamily(FAMILIES.find((item) => item.rooms.includes(next.room))?.family || '')
    setError('')
  }, [open, initial?.id])

  const clients = useMemo(() => [...new Set(bookings.map((item) => item.client).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')), [bookings])
  const favorite = useMemo(() => favoriteRoom(draft.client, bookings), [draft.client, bookings])
  const availability = useMemo(() => Object.fromEntries(SALE_DEF.map(([room]) => [room, availabilityFor(room,draft,bookings,initial?.id)])), [draft.dateFrom,draft.dateTo,draft.shift,bookings,initial?.id])
  const familyData = FAMILIES.find((item) => item.family === family)

  useEffect(() => {
    if (initial || !favorite || draft.room) return
    if (availability[favorite]?.state === 'free') {
      setFamily(FAMILIES.find((item) => item.rooms.includes(favorite))?.family || '')
      setDraft((current) => ({...current,room:favorite}))
    }
  }, [favorite, availability[favorite]?.state])

  const chooseFamily = (item) => {
    setFamily(item.family)
    const single = item.rooms.length === 1 ? item.rooms[0] : ''
    setDraft((current) => ({...current,room:single}))
  }
  const validRange = draft.dateFrom && draft.dateTo && draft.dateTo >= draft.dateFrom
  const roomOk = draft.room && availability[draft.room]?.state !== 'busy'
  const valid = draft.client.trim() && validRange && roomOk

  const submit = async (event) => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      const payload = {room:draft.room,dateFrom:draft.dateFrom,dateTo:draft.dateTo,shift:draft.shift,client:draft.client.trim(),notes:draft.notes.trim()}
      if (initial) await updateBookingRow(initial.id,{...payload,hotelId:hotel.id})
      else await insertBooking({...payload,hotelId:hotel.id,status:'pending',createdBy:user?.name || 'Paolo'})
      await onSaved?.(); onClose?.()
    } catch (e) { setError(e?.message || 'Salvataggio non riuscito') }
    finally { setSaving(false) }
  }

  return <Sheet open={open} onClose={onClose} className="rs-sale-sheet">
    <form onSubmit={submit} className="rs-sale-form-v2">
      <header className="rs-sale-form-v2__head"><div><small>Planning sale</small><h2>{initial ? 'Modifica prenotazione' : 'Nuova prenotazione'}</h2></div><button type="button" className="rs-iconbtn" onClick={onClose}><Icon name="close" /></button></header>

      <label className="rs-sale-field">Cliente *
        <input list="sale-clienti" value={draft.client} onChange={(e)=>setDraft({...draft,client:e.target.value,room:initial?draft.room:''})} placeholder="Nome cliente / azienda" />
        <datalist id="sale-clienti">{clients.map((client)=><option key={client} value={client}/>)}</datalist>
        {favorite && <small className="rs-sale-hint">Sala abituale: <b>{favorite}</b> · {availability[favorite]?.label}</small>}
      </label>

      <div className="rs-sale-dates"><label className="rs-sale-field">Da *<input type="date" value={draft.dateFrom} onChange={(e)=>setDraft({...draft,dateFrom:e.target.value,dateTo:draft.dateTo<e.target.value?e.target.value:draft.dateTo,room:''})}/></label><label className="rs-sale-field">A *<input type="date" min={draft.dateFrom} value={draft.dateTo} onChange={(e)=>setDraft({...draft,dateTo:e.target.value,room:''})}/></label></div>

      <fieldset className="rs-sale-block"><legend>Turno *</legend><div className="rs-sale-segment">{SHIFTS.map(([key,text])=><button key={key} type="button" className={draft.shift===key?'active':''} onClick={()=>setDraft({...draft,shift:key,room:''})}>{text}</button>)}</div></fieldset>

      <fieldset className="rs-sale-block"><legend>Disponibilità sale</legend><div className="rs-sale-family-grid">{FAMILIES.map((item)=>{const states=item.rooms.map((room)=>availability[room]?.state);const state=states.every((x)=>x==='busy')?'busy':states.some((x)=>x==='free')?'free':'partial';return <button key={item.family} type="button" className={`${family===item.family?'active':''} ${state}`} onClick={()=>chooseFamily(item)}><span>{item.family}</span><small>{state==='free'?'Disponibile':state==='busy'?'Occupata':'Parziale'}</small></button>})}</div></fieldset>

      {familyData?.rooms.length > 1 && <fieldset className="rs-sale-block"><legend>Combinazione *</legend><div className="rs-sale-room-grid">{familyData.rooms.map((room)=>{const av=availability[room];return <button key={room} type="button" disabled={av.state==='busy'} className={`${draft.room===room?'active':''} ${av.state}`} onClick={()=>setDraft({...draft,room})}><span>{room.replace(`${family} `,'')}</span><small>{av.label}</small></button>})}</div></fieldset>}

      {familyData?.rooms.length === 1 && draft.room && <div className={`rs-sale-picked ${availability[draft.room]?.state}`}><b>{draft.room}</b><span>{availability[draft.room]?.label}</span></div>}

      <label className="rs-sale-field">Note <textarea rows="3" value={draft.notes} onChange={(e)=>setDraft({...draft,notes:e.target.value})} placeholder="Allestimento, persone, richieste..." /></label>
      {!validRange && <p className="rs-sale-error">La data finale deve essere uguale o successiva alla data iniziale.</p>}
      {draft.room && availability[draft.room]?.state==='busy' && <p className="rs-sale-error">La sala scelta è occupata o in conflitto con una combinazione già prenotata.</p>}
      {error && <p className="rs-sale-error">{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={!valid || saving}>{saving?'Salvo…':initial?'Salva modifiche':'Prenota'}</Button>
    </form>
  </Sheet>
}

function BookingCard({ booking, user, canManage, canStatus, onEdit, onDelete, onRefresh }) {
  const [busy,setBusy] = useState(false)
  const status = booking.status || 'pending'
  const setStatus = async (next) => {
    if (busy) return
    setBusy(true)
    try {
      if (next === 'done') await updateBookingRow(booking.id,{hotelId:booking.hotelId,status:'done',doneBy:user?.name || '',doneAt:Date.now()})
      else if (next === 'da_finire') await updateBookingRow(booking.id,{hotelId:booking.hotelId,status:'da_finire',toFinishBy:user?.name || '',toFinishAt:Date.now(),doneBy:null,doneAt:null})
      else await updateBookingRow(booking.id,{hotelId:booking.hotelId,status:'pending',toFinishBy:null,toFinishAt:null,doneBy:null,doneAt:null})
      await onRefresh?.()
    } finally { setBusy(false) }
  }
  const tone = status==='done'?'done':status==='da_finire'?'finish':'todo'
  return <article className={`rs-sale-card rs-sale-card--${tone}`}>
    <div className="rs-sale-card__top"><div><strong>{booking.room}</strong><span>{booking.client}</span></div><b>{status==='done'?'Fatto':status==='da_finire'?'Da finire':'Da fare'}</b></div>
    <div className="rs-sale-card__meta"><span>{SHIFT_LABEL[booking.shift] || booking.shift}</span><span>{booking.dateFrom || booking.date}{(booking.dateTo||booking.date)!==(booking.dateFrom||booking.date)?` → ${booking.dateTo||booking.date}`:''}</span></div>
    {booking.notes && <p>{booking.notes}</p>}
    {status==='da_finire' && booking.toFinishBy && <small className="rs-sale-card__trace">Da finire · {booking.toFinishBy}{booking.toFinishAt?` · ${new Date(booking.toFinishAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}
    {status==='done' && booking.doneBy && <small className="rs-sale-card__trace">Fatto da {booking.doneBy}{booking.doneAt?` · ${new Date(booking.doneAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}
    <div className="rs-sale-card__actions">
      {canStatus && status!=='done' && <>{status==='da_finire'?<button type="button" className="rs-btn rs-btn--ghost" disabled={busy} onClick={()=>setStatus('pending')}>Da fare</button>:<button type="button" className="rs-btn rs-btn--ghost" disabled={busy} onClick={()=>setStatus('da_finire')}>Da finire</button>}<button type="button" className="rs-btn rs-btn--primary" disabled={busy} onClick={()=>setStatus('done')}>✓ Fatto</button></>}
      {canStatus && status==='done' && <button type="button" className="rs-btn rs-btn--ghost" disabled={busy} onClick={()=>setStatus('pending')}>Riapri</button>}
      {canManage && <><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>onEdit(booking)}>Modifica</button><button type="button" className="rs-iconbtn" onClick={()=>onDelete(booking)} aria-label="Elimina"><Icon name="trash" /></button></>}
    </div>
  </article>
}

export default function PlanningSaleV2({ hotel, user, openRequest=0 }) {
  const [bookings,setBookings] = useState([])
  const [anchor,setAnchor] = useState(()=>startDay())
  const [creating,setCreating] = useState(false)
  const [editing,setEditing] = useState(null)
  const canManage = isPaolo(user)
  const canStatus = canManage || isMaintainer(user)
  const load = async () => { const result = await fetchBookings(hotel.id); setBookings(result.items || []) }

  useEffect(()=>{load();const off=subscribeBookings(hotel.id,load);return()=>off?.()},[hotel.id])
  useEffect(()=>{if(openRequest && canManage)setCreating(true)},[openRequest,canManage])

  const date = iso(anchor)
  const entries = useMemo(()=>bookings.filter((item)=>(item.dateFrom||item.date)<=date&&(item.dateTo||item.date)>=date).sort((a,b)=>String(a.room).localeCompare(String(b.room),'it')),[bookings,date])
  const stats = useMemo(()=>({todo:entries.filter((x)=>x.status!=='done'&&x.status!=='da_finire').length,finish:entries.filter((x)=>x.status==='da_finire').length,done:entries.filter((x)=>x.status==='done').length}),[entries])

  const remove = async (booking) => {
    if (!canManage || !window.confirm(`Eliminare la prenotazione di “${booking.client}”?`)) return
    await deleteBookingRow(booking.id,hotel.id); await load()
  }

  return <section className="rs-sale-v2">
    <div className="rs-sale-v2__head"><div><h2>Planning sale</h2><p>{canManage?'Gestione prenotazioni e disponibilità.':'Vista operativa · puoi aggiornare solo lo stato.'}</p></div>{canManage&&<Button variant="primary" onClick={()=>setCreating(true)}>＋ Nuova prenotazione</Button>}</div>
    <div className="rs-sale-daynav"><button type="button" onClick={()=>setAnchor(addDays(anchor,-1))}>‹</button><button type="button" className="today" onClick={()=>setAnchor(startDay())}><strong>{label(anchor)}</strong>{date===iso(new Date())&&<small>OGGI</small>}</button><button type="button" onClick={()=>setAnchor(addDays(anchor,1))}>›</button></div>
    <div className="rs-sale-stats"><div><b>{stats.todo}</b><span>Da fare</span></div><div><b>{stats.finish}</b><span>Da finire</span></div><div><b>{stats.done}</b><span>Fatti</span></div></div>
    <div className="rs-sale-list">{entries.length?entries.map((booking)=><BookingCard key={booking.id} booking={booking} user={user} canManage={canManage} canStatus={canStatus} onEdit={setEditing} onDelete={remove} onRefresh={load}/>):<div className="rs-sale-empty"><Icon name="calendar"/><strong>Nessuna sala prevista</strong><span>{canManage?'Puoi creare una nuova prenotazione.':'Nessuna attività per questa giornata.'}</span></div>}</div>
    <BookingSheet open={creating||Boolean(editing)} onClose={()=>{setCreating(false);setEditing(null)}} hotel={hotel} user={user} bookings={bookings} initial={editing} onSaved={load}/>
  </section>
}
