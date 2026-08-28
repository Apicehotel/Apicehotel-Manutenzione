import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../planning-work-data.js'
import { fetchBookings, subscribeBookings } from '../sale-data.js'
import { canUser } from '../permissions.js'
import { Spinner } from './ui.jsx'
import PlanningWorkSimple from './PlanningWorkSimple.jsx'
import PlanningSaleSimple from './PlanningSaleSimple.jsx'
import PlannedCreateSheet from './PlannedCreateSheet.jsx'
import { SaleEventCalendar, eventOnDay, isoDay } from './planning/PlanningOverview.jsx'

function Summary({icon,title,stats}){
  return <div style={{border:'1px solid var(--rs-line)',borderRadius:16,padding:12,background:'var(--rs-surface)',display:'grid',gap:10}}>
    <div style={{display:'flex',alignItems:'center',gap:9,fontWeight:850}}><span aria-hidden="true">{icon}</span><span>{title}</span></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:7}}>
      <div><b style={{display:'block',fontSize:'1.15rem'}}>{stats.today}</b><small style={{color:'var(--rs-text-3)'}}>Oggi</small></div>
      <div><b style={{display:'block',fontSize:'1.15rem',color:'var(--rs-warn)'}}>{stats.finish}</b><small style={{color:'var(--rs-text-3)'}}>Da finire</small></div>
      <div><b style={{display:'block',fontSize:'1.15rem',color:'var(--rs-ok)'}}>{stats.done}</b><small style={{color:'var(--rs-text-3)'}}>Fatti</small></div>
    </div>
  </div>
}

export default function PlanningHub({hotel,user,createRequest=null,allowSale=true}){
  const [work,setWork]=useState([]),[bookings,setBookings]=useState([]),[loading,setLoading]=useState(true),[workCreateSignal,setWorkCreateSignal]=useState(0),[saleCreateSignal,setSaleCreateSignal]=useState(0),[interventionCreateOpen,setInterventionCreateOpen]=useState(false)
  const canSeeWork=canUser(user,'planning_work','view')
  const canSeeSale=allowSale&&canUser(user,'planning_sale','view')
  const load=useCallback(async()=>{setLoading(true);try{const [workItems,sales]=await Promise.all([canSeeWork?fetchPlanningWork(hotel.id):Promise.resolve([]),canSeeSale?fetchBookings(hotel.id):Promise.resolve({items:[]})]);setWork(workItems||[]);setBookings(sales.items||[])}finally{setLoading(false)}},[hotel.id,canSeeWork,canSeeSale])
  useEffect(()=>{load();const offWork=canSeeWork?subscribePlanningWork(hotel.id,load):null;const offSales=canSeeSale?subscribeBookings(hotel.id,load):null;return()=>{offWork?.();offSales?.()}},[hotel.id,load,canSeeWork,canSeeSale])
  useEffect(()=>{if(!createRequest?.nonce)return;if(createRequest.kind==='work'&&canSeeWork){let source='planning-work';try{source=sessionStorage.getItem('randapp.insert-source')||source;sessionStorage.removeItem('randapp.insert-source')}catch{}if(source==='intervention')setInterventionCreateOpen(true);else setWorkCreateSignal(n=>n+1)}if(createRequest.kind==='sale'&&canSeeSale)setSaleCreateSignal(n=>n+1)},[createRequest?.nonce,createRequest?.kind,canSeeWork,canSeeSale])
  const today=isoDay()
  const todayWork=useMemo(()=>work.filter(item=>item.date===today),[work,today])
  const todayEventSales=useMemo(()=>bookings.filter(item=>eventOnDay(item,today)),[bookings,today])
  const todayPrepSales=useMemo(()=>bookings.filter(item=>(item.prepDate||item.dateFrom||item.date)===today),[bookings,today])
  const workStats={today:todayWork.filter(x=>x.status!=='done').length,finish:todayWork.filter(x=>x.status==='da_finire').length,done:todayWork.filter(x=>x.status==='done').length}
  const saleStats={today:todayPrepSales.filter(x=>x.status!=='done').length,finish:todayPrepSales.filter(x=>x.status==='da_finire').length,done:todayPrepSales.filter(x=>x.status==='done').length}
  if(loading)return <Spinner label="Carico planning…"/>
  return <div data-testid="planning-hub" style={{display:'grid',gap:16}}>
    <div className="rs-page-title"><div><h1>Planning</h1><p>Lavori e sale in un’unica schermata operativa.</p></div></div>
    {(canSeeWork||canSeeSale)&&<div style={{display:'grid',gridTemplateColumns:canSeeWork&&canSeeSale?'repeat(2,minmax(0,1fr))':'1fr',gap:10}}>{canSeeWork&&<Summary icon="🔧" title="Lavori" stats={workStats}/>} {canSeeSale&&<Summary icon="▣" title="Sale" stats={saleStats}/>}</div>}
    {canSeeWork&&<section style={{display:'grid',gap:10}}><div><h2 style={{margin:0,fontFamily:'Sora'}}>Lavori</h2><p style={{margin:'4px 0 0',color:'var(--rs-text-2)'}}>{todayWork.length?`${todayWork.length} lavor${todayWork.length===1?'o':'i'} previsto oggi.`:'Nessun lavoro previsto oggi.'}</p></div><PlanningWorkSimple hotel={hotel} user={user} openRequest={workCreateSignal}/></section>}
    {canSeeSale&&<section style={{display:'grid',gap:10}}><div><h2 style={{margin:0,fontFamily:'Sora'}}>Sale</h2><p style={{margin:'4px 0 0',color:'var(--rs-text-2)'}}>{todayEventSales.length?`${todayEventSales.length} attività/prenotazioni in corso oggi.`:'Nessuna sala occupata oggi.'}</p></div><SaleEventCalendar bookings={bookings}/><PlanningSaleSimple hotel={hotel} user={user} openRequest={saleCreateSignal}/></section>}
    <PlannedCreateSheet open={interventionCreateOpen} onClose={()=>setInterventionCreateOpen(false)} hotel={hotel} user={user} onSaved={()=>setInterventionCreateOpen(false)}/>
  </div>
}
