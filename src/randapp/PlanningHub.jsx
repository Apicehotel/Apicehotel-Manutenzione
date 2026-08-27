import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanning, subscribePlanned } from '../planned-data.js'
import { fetchBookings } from '../sale-data.js'
import { PlanningWork, PlanningSale } from '../planning.jsx'
import { Icon, Spinner } from './ui.jsx'
import PlannedCreateSheet from './PlannedCreateSheet.jsx'

const startDay = (value = new Date()) => { const d = new Date(value); d.setHours(0,0,0,0); return d }
const endDay = (value = new Date()) => { const d = startDay(value); d.setDate(d.getDate()+1); return d.getTime()-1 }
const isoDay = (value = new Date()) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const sameDay = (value, today = new Date()) => value && isoDay(value) === isoDay(today)
const statusTone = (status) => status === 'done' ? 'done' : status === 'da_finire' ? 'finish' : 'todo'
const statusLabel = (status) => status === 'done' ? 'Completata' : status === 'da_finire' ? 'Da finire' : 'Da fare'

function Metric({ value, label, tone = 'cyan' }) {
  const color = tone === 'ok' ? 'var(--rs-ok)' : tone === 'warn' ? 'var(--rs-warn)' : 'var(--rs-text-2)'
  return <div style={{width:'54px',height:'54px',border:'1px solid var(--rs-line)',borderRadius:'14px',background:'var(--rs-surface-2)',display:'grid',placeItems:'center',alignContent:'center',lineHeight:1.05,flex:'0 0 auto'}}>
    <b style={{fontFamily:'Sora',fontSize:'1.05rem',color}}>{value}</b>
    <small style={{fontSize:'.58rem',color:'var(--rs-text-2)',marginTop:'4px',whiteSpace:'nowrap'}}>{label}</small>
  </div>
}

function PlanningChoice({ active, icon, title, stats, onClick }) {
  return <button type="button" onClick={onClick} aria-pressed={active} style={{minWidth:0,textAlign:'left',color:'var(--rs-text)',border:`1px solid ${active?'var(--rs-line-strong)':'var(--rs-line)'}`,background:active?'var(--rs-surface-3)':'var(--rs-surface)',borderRadius:'18px',padding:'12px',boxShadow:active?'var(--rs-glow)':'var(--rs-shadow)',cursor:'pointer'}}>
    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}><span style={{width:'34px',height:'34px',borderRadius:'11px',display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:'var(--rs-cyan)'}}><Icon name={icon}/></span><strong style={{fontFamily:'Sora',fontSize:'.9rem'}}>{title}</strong><span style={{marginLeft:'auto',color:'var(--rs-text-3)'}}>›</span></div>
    <div style={{display:'flex',gap:'6px',justifyContent:'space-between'}}>
      <Metric value={stats.today} label="Oggi" />
      <Metric value={stats.progress} label="Da finire" tone="warn" />
      <Metric value={stats.done} label="Fatti oggi" tone="ok" />
    </div>
  </button>
}

function TodayRow({ kind, item }) {
  const tone = statusTone(item.status)
  const bg = tone === 'done' ? 'color-mix(in srgb,var(--rs-ok) 12%,var(--rs-surface))' : tone === 'finish' ? 'color-mix(in srgb,var(--rs-warn) 14%,var(--rs-surface))' : 'var(--rs-surface-2)'
  const border = tone === 'done' ? 'color-mix(in srgb,var(--rs-ok) 45%,var(--rs-line))' : tone === 'finish' ? 'color-mix(in srgb,var(--rs-warn) 45%,var(--rs-line))' : 'var(--rs-line)'
  const accent = tone === 'done' ? 'var(--rs-ok)' : tone === 'finish' ? 'var(--rs-warn)' : 'var(--rs-text-3)'
  const title = kind === 'work' ? (item.location || item.category || 'Intervento') : (item.room || 'Sala')
  const detail = kind === 'work' ? (item.notes || item.category || '') : [item.client,item.notes].filter(Boolean).join(' · ')
  return <article style={{border:`1px solid ${border}`,background:bg,borderRadius:'14px',padding:'11px 12px',display:'grid',gap:'4px'}}>
    <div style={{display:'flex',alignItems:'center',gap:'8px'}}><strong style={{fontSize:'.9rem',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</strong><span style={{marginLeft:'auto',fontSize:'.7rem',fontWeight:800,color:accent,whiteSpace:'nowrap'}}>{statusLabel(item.status)}</span></div>
    {detail && <small style={{color:'var(--rs-text-2)',lineHeight:1.35}}>{detail}</small>}
  </article>
}

function TodaySection({ title, icon, items, emptyText }) {
  return <section style={{display:'grid',gap:'9px'}}>
    <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{width:'30px',height:'30px',borderRadius:'10px',display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:'var(--rs-cyan)'}}><Icon name={icon}/></span><h2 style={{margin:0,fontFamily:'Sora',fontSize:'1rem'}}>{title}</h2><span style={{marginLeft:'auto',fontSize:'.75rem',color:'var(--rs-text-3)'}}>{items.length}</span></div>
    <div style={{display:'grid',gap:'7px'}}>{items.length ? items.map(item=><TodayRow key={item.id} kind={title.includes('Lavori')?'work':'sale'} item={item}/>) : <div style={{border:'1px solid var(--rs-line)',background:'var(--rs-surface)',borderRadius:'14px',padding:'14px',color:'var(--rs-text-3)',fontSize:'.85rem'}}>{emptyText}</div>}</div>
  </section>
}

export default function PlanningHub({ hotel, user }) {
  const [section,setSection] = useState(null)
  const [planned,setPlanned] = useState([])
  const [bookings,setBookings] = useState([])
  const [loading,setLoading] = useState(true)
  const [workCreateOpen,setWorkCreateOpen] = useState(false)
  const [saleCreateSignal,setSaleCreateSignal] = useState(0)
  const hasSales = Boolean(hotel?.id)

  const load = useCallback(async()=>{
    setLoading(true)
    try {
      const [workResult,saleResult] = await Promise.all([
        fetchPlanning(hotel.id),
        hasSales ? fetchBookings(hotel.id) : Promise.resolve({items:[]}),
      ])
      setPlanned(workResult.items || [])
      setBookings(saleResult.items || [])
    } finally { setLoading(false) }
  },[hotel.id,hasSales])

  useEffect(()=>{
    setSection(null)
    load()
    const offWork = subscribePlanned(hotel.id, load)
    return ()=>{ offWork?.() }
  },[hotel.id,load])

  useEffect(() => {
    let pending = null
    try {
      pending = sessionStorage.getItem('randapp.pending-insert')
      if (pending) sessionStorage.removeItem('randapp.pending-insert')
    } catch { /* nessun blocco se sessionStorage non è disponibile */ }
    if (pending === 'planning-work') {
      setSection('work')
      setWorkCreateOpen(true)
    }
    if (pending === 'planning-sale' && hasSales) {
      setSection('sale')
      setSaleCreateSignal((value) => value + 1)
    }
  }, [hasSales])

  const todayWork = useMemo(()=>{
    const start = startDay().getTime(), end = endDay()
    return planned
      .filter(item => Number(item.scheduledAt) <= end && Number(item.scheduledUntil || item.scheduledAt) >= start)
      .sort((a,b)=>(a.scheduledAt||0)-(b.scheduledAt||0))
  },[planned])

  const todaySales = useMemo(()=>{
    const today = isoDay()
    return bookings
      .filter(item => (item.dateFrom || item.date) <= today && (item.dateTo || item.date) >= today)
      .sort((a,b)=>String(a.room||'').localeCompare(String(b.room||''),'it'))
  },[bookings])

  const workStats = useMemo(()=>({
    today: todayWork.filter(item => item.status !== 'done').length,
    progress: todayWork.filter(item => item.status === 'da_finire').length,
    done: todayWork.filter(item => item.status === 'done' || sameDay(item.completedAt)).length,
  }),[todayWork])

  const saleStats = useMemo(()=>({
    today: todaySales.filter(item => item.status !== 'done').length,
    progress: todaySales.filter(item => item.status === 'da_finire').length,
    done: todaySales.filter(item => item.status === 'done' || sameDay(item.doneAt)).length,
  }),[todaySales])

  if (loading) return <Spinner label="Carico planning…" />

  return <div data-testid="planning-hub">
    <div className="rs-page-title"><div><h1>Planning</h1><p>{section ? 'Calendario operativo.' : 'Oggi · lavori e sale della giornata.'}</p></div>{section && <button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setSection(null)}>‹ Oggi</button>}</div>

    <div style={{display:'grid',gridTemplateColumns:hasSales?'repeat(2,minmax(0,1fr))':'minmax(0,360px)',gap:'10px',marginBottom:'16px'}}>
      <PlanningChoice active={section==='work'} icon="wrench" title="Planning lavori" stats={workStats} onClick={()=>setSection('work')} />
      {hasSales && <PlanningChoice active={section==='sale'} icon="calendar" title="Planning sale" stats={saleStats} onClick={()=>setSection('sale')} />}
    </div>

    {!section ? <div style={{display:'grid',gap:'18px'}}>
      <TodaySection title="Lavori oggi" icon="wrench" items={todayWork} emptyText="Nessun lavoro previsto oggi." />
      {hasSales && <TodaySection title="Sale oggi" icon="calendar" items={todaySales} emptyText="Nessuna sala prevista oggi." />}
      <div style={{display:'flex',gap:'12px',alignItems:'center',fontSize:'.72rem',color:'var(--rs-text-3)',flexWrap:'wrap'}}><span>● Grigio · Da fare</span><span style={{color:'var(--rs-warn)'}}>● Arancione · Da finire</span><span style={{color:'var(--rs-ok)'}}>● Verde · Completate</span></div>
    </div> : <div className="rs-legacy rs-legacy--planning">
      {section==='work' ? <PlanningWork items={planned} onOpen={()=>{}} /> : <PlanningSale hotel={hotel} user={user} openRequest={saleCreateSignal} />}
    </div>}

    <PlannedCreateSheet open={workCreateOpen} onClose={()=>setWorkCreateOpen(false)} hotel={hotel} user={user} onSaved={load} />
  </div>
}
