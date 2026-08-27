import { useEffect, useMemo, useState } from 'react'
import { createPlanningWork, deletePlanningWorkDay, fetchPlanningWork, setPlanningWorkStatus, subscribePlanningWork } from '../planning-work-data.js'
import { Button, Icon, Sheet } from './ui.jsx'

const WD = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const startDay = (value = new Date()) => { const d = new Date(value); d.setHours(0,0,0,0); return d }
const mondayOf = (value = new Date()) => { const d = startDay(value); const day=d.getDay(); d.setDate(d.getDate() + (day===0?-6:1-day)); return d }
const addDays = (date,n) => { const d=new Date(date); d.setDate(d.getDate()+n); return d }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const label = (d) => `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`
const rangeLabel = (start) => `${start.getDate()}/${start.getMonth()+1} – ${addDays(start,6).getDate()}/${addDays(start,6).getMonth()+1}`

function NewWorkSheet({ open, onClose, weekStart, hotel, user, onSaved }) {
  const [weekOffset,setWeekOffset]=useState(0)
  const activeWeek=useMemo(()=>addDays(weekStart,weekOffset*7),[weekStart,weekOffset])
  const days = useMemo(()=>Array.from({length:7},(_,i)=>addDays(activeWeek,i)),[activeWeek])
  const [description,setDescription]=useState('')
  const [selected,setSelected]=useState([])
  const [saving,setSaving]=useState(false)
  useEffect(()=>{ if(open){ setDescription(''); setSelected([]); setWeekOffset(0) } },[open])
  useEffect(()=>{ setSelected([]) },[weekOffset])
  const toggle=(date)=>setSelected((current)=>current.includes(date)?current.filter((x)=>x!==date):[...current,date])
  const submit=async(e)=>{
    e.preventDefault(); if(!description.trim()||!selected.length||saving)return
    setSaving(true)
    try{
      await createPlanningWork({hotelId:hotel.id,description:description.trim(),dates:selected,createdBy:user?.name||'',createdByUserId:user?.auth_user_id||null})
      onSaved?.(); onClose?.()
    } finally { setSaving(false) }
  }
  return <Sheet open={open} onClose={onClose} className="rs-insert-shell">
    <form onSubmit={submit} style={{display:'grid',gap:18}}>
      <header style={{display:'flex',alignItems:'center',gap:10}}><button type="button" className="rs-btn rs-btn--ghost" onClick={onClose}>‹</button><h2 style={{margin:0,fontFamily:'Sora'}}>Nuovo lavoro</h2></header>
      <label style={{display:'grid',gap:8,fontWeight:800}}>Descrizione *<textarea className="rs-textarea" rows="3" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Es. Controllo caldaia" /></label>
      <div style={{display:'grid',gap:9}}>
        <strong>Settimana</strong>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,padding:4,border:'1px solid var(--rs-line)',borderRadius:14,background:'var(--rs-surface-2)'}}>
          <button type="button" className={`rs-btn ${weekOffset===0?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setWeekOffset(0)}>Questa · {rangeLabel(weekStart)}</button>
          <button type="button" className={`rs-btn ${weekOffset===1?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>setWeekOffset(1)}>Seguente · {rangeLabel(addDays(weekStart,7))}</button>
        </div>
      </div>
      <div style={{display:'grid',gap:10}}><strong>Giorni *</strong><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{days.map((day)=>{const value=iso(day);const active=selected.includes(value);return <button key={value} type="button" className={`rs-btn ${active?'rs-btn--primary':'rs-btn--ghost'}`} onClick={()=>toggle(value)}>{label(day)}</button>})}</div></div>
      <Button type="submit" variant="primary" size="lg" disabled={!description.trim()||!selected.length||saving}>✓ Crea lavoro su {selected.length} giorn{selected.length===1?'o':'i'}</Button>
    </form>
  </Sheet>
}

function WorkRow({ item, user, onChanged }) {
  const done=item.status==='done'
  const finish=item.status==='da_finire'
  const act=async(status)=>{ await setPlanningWorkStatus(item.id,status,user?.name||''); onChanged?.() }
  return <article style={{border:'1px solid var(--rs-line)',background:'var(--rs-surface)',borderRadius:16,padding:12,display:'grid',gap:8}}>
    <div style={{display:'grid',gridTemplateColumns:'44px minmax(0,1fr) auto',gap:10,alignItems:'center'}}>
      <button type="button" onClick={()=>act(done?'pending':'done')} aria-label={done?'Riapri lavoro':'Segna fatto'} style={{width:44,height:44,borderRadius:12,border:'none',background:done?'var(--rs-ok)':finish?'var(--rs-warn)':'var(--rs-surface-2)',color:done?'white':'var(--rs-text)',fontSize:20}}>{done?'✓':'·'}</button>
      <div style={{minWidth:0}}><strong style={{display:'block',textDecoration:done?'line-through':'none'}}>{item.description}</strong>{done&&item.doneBy&&<small style={{display:'block',marginTop:4,color:'var(--rs-ok)'}}>Fatto da {item.doneBy}{item.doneAt?` · ${new Date(item.doneAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:''}</small>}{finish&&<small style={{display:'block',marginTop:4,color:'var(--rs-warn)',fontWeight:800}}>Da finire</small>}</div>
      <button type="button" className="rs-btn rs-btn--ghost" onClick={async()=>{await deletePlanningWorkDay(item.id);onChanged?.()}} aria-label="Elimina"><Icon name="trash"/></button>
    </div>
    {!done&&<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>{finish?<button type="button" className="rs-btn rs-btn--ghost" onClick={()=>act('pending')}>Da fare</button>:<button type="button" className="rs-btn rs-btn--ghost" onClick={()=>act('da_finire')}>Da finire</button>}<button type="button" className="rs-btn rs-btn--primary" onClick={()=>act('done')}>✓ Fatto</button></div>}
  </article>
}

export default function PlanningWorkSimple({ hotel, user, openRequest=0 }) {
  const [anchor,setAnchor]=useState(()=>mondayOf())
  const [items,setItems]=useState([])
  const [creating,setCreating]=useState(false)
  const weekStart=mondayOf(anchor)
  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart])
  const load=async()=>setItems(await fetchPlanningWork(hotel.id))
  useEffect(()=>{load();const off=subscribePlanningWork(hotel.id,load);return off},[hotel.id])
  useEffect(()=>{if(openRequest)setCreating(true)},[openRequest])
  const weekLabel=rangeLabel(weekStart)
  return <section style={{display:'grid',gap:14}}>
    <div style={{display:'grid',gridTemplateColumns:'48px 1fr 48px',alignItems:'center',gap:8}}><button className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(addDays(weekStart,-7))}>‹</button><div style={{textAlign:'center',fontWeight:800}}>{weekLabel}</div><button className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(addDays(weekStart,7))}>›</button></div>
    <Button variant="primary" size="lg" onClick={()=>setCreating(true)}>＋ Nuovo lavoro</Button>
    {days.map((day)=>{const date=iso(day);const list=items.filter((item)=>item.date===date);const today=date===iso(new Date());return <section key={date} style={{display:'grid',gap:9}}><h3 style={{margin:'8px 0 0',fontFamily:'Sora',color:today?'var(--rs-ok)':'var(--rs-text)'}}>{label(day)}{today?' · oggi':''}</h3>{list.length?list.map((item)=><WorkRow key={item.id} item={item} user={user} onChanged={load}/>):<p style={{margin:0,color:'var(--rs-text-3)'}}>Nessun lavoro.</p>}</section>})}
    <NewWorkSheet open={creating} onClose={()=>setCreating(false)} weekStart={weekStart} hotel={hotel} user={user} onSaved={load}/>
  </section>
}
