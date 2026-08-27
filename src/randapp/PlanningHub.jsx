import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../planning-work-data.js'
import { fetchBookings } from '../sale-data.js'
import { PlanningSale } from '../planning.jsx'
import { Icon, Spinner } from './ui.jsx'
import PlanningWorkSimple from './PlanningWorkSimple.jsx'

const isoDay = (value = new Date()) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function Metric({ value, label, tone = 'normal' }) {
  const color = tone === 'done' ? 'var(--rs-ok)' : tone === 'finish' ? 'var(--rs-warn)' : 'var(--rs-text-2)'
  return <div style={{width:54,height:54,border:'1px solid var(--rs-line)',borderRadius:14,background:'var(--rs-surface-2)',display:'grid',placeItems:'center',alignContent:'center'}}><b style={{fontFamily:'Sora',fontSize:'1.05rem',color}}>{value}</b><small style={{fontSize:'.58rem',color:'var(--rs-text-2)',marginTop:4}}>{label}</small></div>
}

function PlanningChoice({ active, icon, title, stats, onClick }) {
  return <button type="button" onClick={onClick} aria-pressed={active} style={{minWidth:0,textAlign:'left',color:'var(--rs-text)',border:`1px solid ${active?'var(--rs-line-strong)':'var(--rs-line)'}`,background:active?'var(--rs-surface-3)':'var(--rs-surface)',borderRadius:18,padding:12,boxShadow:active?'var(--rs-glow)':'var(--rs-shadow)'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span style={{width:34,height:34,borderRadius:11,display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:'var(--rs-cyan)'}}><Icon name={icon}/></span><strong style={{fontFamily:'Sora',fontSize:'.9rem'}}>{title}</strong><span style={{marginLeft:'auto',color:'var(--rs-text-3)'}}>›</span></div><div style={{display:'flex',gap:6,justifyContent:'space-between'}}><Metric value={stats.today} label="Oggi"/><Metric value={stats.finish} label="Da finire" tone="finish"/><Metric value={stats.done} label="Fatti oggi" tone="done"/></div></button>
}

export default function PlanningHub({ hotel, user, createRequest = null }) {
  const [section,setSection]=useState(null)
  const [work,setWork]=useState([])
  const [bookings,setBookings]=useState([])
  const [loading,setLoading]=useState(true)
  const [workCreateSignal,setWorkCreateSignal]=useState(0)
  const [saleCreateSignal,setSaleCreateSignal]=useState(0)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const [workItems,sales]=await Promise.all([fetchPlanningWork(hotel.id),fetchBookings(hotel.id)])
      setWork(workItems||[]); setBookings(sales.items||[])
    } finally { setLoading(false) }
  },[hotel.id])

  useEffect(()=>{setSection(null);load();const off=subscribePlanningWork(hotel.id,load);return()=>off?.()},[hotel.id,load])
  useEffect(()=>{
    if(!createRequest?.nonce)return
    if(createRequest.kind==='work'){setSection('work');setWorkCreateSignal((n)=>n+1)}
    if(createRequest.kind==='sale'){setSection('sale');setSaleCreateSignal((n)=>n+1)}
  },[createRequest?.nonce,createRequest?.kind])

  const today=isoDay()
  const todayWork=useMemo(()=>work.filter((item)=>item.date===today),[work,today])
  const todaySales=useMemo(()=>bookings.filter((item)=>(item.dateFrom||item.date)<=today&&(item.dateTo||item.date)>=today),[bookings,today])
  const workStats={today:todayWork.filter((x)=>x.status!=='done').length,finish:todayWork.filter((x)=>x.status==='da_finire').length,done:todayWork.filter((x)=>x.status==='done').length}
  const saleStats={today:todaySales.filter((x)=>x.status!=='done').length,finish:todaySales.filter((x)=>x.status==='da_finire').length,done:todaySales.filter((x)=>x.status==='done').length}

  if(loading)return <Spinner label="Carico planning…"/>
  return <div data-testid="planning-hub">
    <div className="rs-page-title"><div><h1>Planning</h1><p>{section?'Calendario operativo.':'Lavori e sale restano separati.'}</p></div>{section&&<button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setSection(null)}>‹ Oggi</button>}</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:16}}><PlanningChoice active={section==='work'} icon="wrench" title="Planning lavori" stats={workStats} onClick={()=>setSection('work')}/><PlanningChoice active={section==='sale'} icon="calendar" title="Planning sale" stats={saleStats} onClick={()=>setSection('sale')}/></div>
    {!section?<div style={{display:'grid',gap:12}}><div style={{border:'1px solid var(--rs-line)',borderRadius:16,padding:14,background:'var(--rs-surface)'}}><strong>Lavori oggi</strong><p style={{margin:'6px 0 0',color:'var(--rs-text-2)'}}>{todayWork.length?`${todayWork.length} lavor${todayWork.length===1?'o':'i'} nel planning.`:'Nessun lavoro previsto oggi.'}</p></div><div style={{border:'1px solid var(--rs-line)',borderRadius:16,padding:14,background:'var(--rs-surface)'}}><strong>Sale oggi</strong><p style={{margin:'6px 0 0',color:'var(--rs-text-2)'}}>{todaySales.length?`${todaySales.length} attività/prenotazioni.`:'Nessuna sala prevista oggi.'}</p></div></div>:section==='work'?<PlanningWorkSimple hotel={hotel} user={user} openRequest={workCreateSignal}/>:<div className="rs-legacy rs-legacy--planning"><PlanningSale hotel={hotel} user={user} openRequest={saleCreateSignal}/></div>}
  </div>
}
