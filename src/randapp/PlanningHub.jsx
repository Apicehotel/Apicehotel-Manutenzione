import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanned, subscribePlanned } from '../planned-data.js'
import { fetchBookings, subscribeBookings } from '../sale-data.js'
import { PlanningWork, PlanningSale } from '../planning.jsx'
import { Icon, Spinner } from './ui.jsx'

const startDay = (value = new Date()) => { const d = new Date(value); d.setHours(0,0,0,0); return d }
const endDay = (value = new Date()) => { const d = startDay(value); d.setDate(d.getDate()+1); return d.getTime()-1 }
const isoDay = (value = new Date()) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const sameDay = (value, today = new Date()) => value && isoDay(value) === isoDay(today)

function Metric({ value, label, tone = 'cyan' }) {
  const color = tone === 'ok' ? 'var(--rs-ok)' : tone === 'warn' ? 'var(--rs-warn)' : 'var(--rs-cyan)'
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
      <Metric value={stats.progress} label="In corso" tone="warn" />
      <Metric value={stats.done} label="Fatti oggi" tone="ok" />
    </div>
  </button>
}

export default function PlanningHub({ hotel, user }) {
  const [section,setSection] = useState('work')
  const [planned,setPlanned] = useState([])
  const [bookings,setBookings] = useState([])
  const [loading,setLoading] = useState(true)
  const hasSales = hotel?.id === 'hotelgio'

  const load = useCallback(async()=>{
    setLoading(true)
    try {
      const [workResult,saleResult] = await Promise.all([
        fetchPlanned(hotel.id),
        hasSales ? fetchBookings(hotel.id) : Promise.resolve({items:[]}),
      ])
      setPlanned(workResult.items || [])
      setBookings(saleResult.items || [])
    } finally { setLoading(false) }
  },[hotel.id,hasSales])

  useEffect(()=>{
    load()
    const offWork = subscribePlanned(hotel.id, load)
    const offSale = hasSales ? subscribeBookings(hotel.id, load) : null
    return ()=>{ offWork?.(); offSale?.() }
  },[hotel.id,hasSales,load])

  useEffect(()=>{ if(!hasSales && section==='sale') setSection('work') },[hasSales,section])

  const workStats = useMemo(()=>{
    const start = startDay().getTime(), end = endDay()
    const todayRows = planned.filter(item => Number(item.scheduledAt) <= end && Number(item.scheduledUntil || item.scheduledAt) >= start)
    return {
      today: todayRows.filter(item => item.status !== 'done').length,
      progress: todayRows.filter(item => ['in_progress','da_finire','presa_in_carico'].includes(item.status)).length,
      done: planned.filter(item => item.status === 'done' && sameDay(item.completedAt)).length,
    }
  },[planned])

  const saleStats = useMemo(()=>{
    const today = isoDay()
    const todayRows = bookings.filter(item => (item.dateFrom || item.date) <= today && (item.dateTo || item.date) >= today)
    return {
      today: todayRows.filter(item => item.status !== 'done').length,
      progress: todayRows.filter(item => item.status === 'da_finire').length,
      done: bookings.filter(item => item.status === 'done' && sameDay(item.doneAt)).length,
    }
  },[bookings])

  if (loading) return <Spinner label="Carico planning…" />

  return <div data-testid="planning-hub">
    <div className="rs-page-title"><div><h1>Planning</h1><p>Attività previste oggi e calendario operativo.</p></div></div>
    <div style={{display:'grid',gridTemplateColumns:hasSales?'repeat(2,minmax(0,1fr))':'minmax(0,360px)',gap:'10px',marginBottom:'16px'}}>
      <PlanningChoice active={section==='work'} icon="wrench" title="Planning lavori" stats={workStats} onClick={()=>setSection('work')} />
      {hasSales && <PlanningChoice active={section==='sale'} icon="calendar" title="Planning sale" stats={saleStats} onClick={()=>setSection('sale')} />}
    </div>
    <div className="rs-legacy rs-legacy--planning">
      {section==='work' ? <PlanningWork items={planned} onOpen={()=>{}} /> : <PlanningSale hotel={hotel} user={user} />}
    </div>
  </div>
}
