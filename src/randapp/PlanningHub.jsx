import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../planning-work-data.js'
import { fetchBookings, subscribeBookings } from '../sale-data.js'
import { canUser } from '../permissions.js'
import { Spinner } from './ui.jsx'
import PlanningWorkSimple from './PlanningWorkSimple.jsx'
import PlanningSaleSimple from './PlanningSaleSimple.jsx'
import PlannedCreateSheet from './PlannedCreateSheet.jsx'
import { PlanningChoice, SaleEventCalendar, eventOnDay, isoDay } from './planning/PlanningOverview.jsx'

export default function PlanningHub({hotel,user,createRequest=null,allowSale=true}){
  const [section,setSection]=useState(null),[work,setWork]=useState([]),[bookings,setBookings]=useState([]),[loading,setLoading]=useState(true),[workCreateSignal,setWorkCreateSignal]=useState(0),[saleCreateSignal,setSaleCreateSignal]=useState(0),[interventionCreateOpen,setInterventionCreateOpen]=useState(false)
  const canSeeWork=canUser(user,'planning_work','view')
  const canSeeSale=allowSale&&canUser(user,'planning_sale','view')
  const load=useCallback(async()=>{setLoading(true);try{const [workItems,sales]=await Promise.all([canSeeWork?fetchPlanningWork(hotel.id):Promise.resolve([]),canSeeSale?fetchBookings(hotel.id):Promise.resolve({items:[]})]);setWork(workItems||[]);setBookings(sales.items||[])}finally{setLoading(false)}},[hotel.id,canSeeWork,canSeeSale])
  useEffect(()=>{setSection(null);load();const offWork=canSeeWork?subscribePlanningWork(hotel.id,load):null;const offSales=canSeeSale?subscribeBookings(hotel.id,load):null;return()=>{offWork?.();offSales?.()}},[hotel.id,load,canSeeWork,canSeeSale])
  useEffect(()=>{if(!createRequest?.nonce)return;if(createRequest.kind==='work'&&canSeeWork){let source='planning-work';try{source=sessionStorage.getItem('randapp.insert-source')||source;sessionStorage.removeItem('randapp.insert-source')}catch{}if(source==='intervention'){setSection(null);setInterventionCreateOpen(true)}else{setSection('work');setWorkCreateSignal(n=>n+1)}}if(createRequest.kind==='sale'&&canSeeSale){setSection('sale');setSaleCreateSignal(n=>n+1)}},[createRequest?.nonce,createRequest?.kind,canSeeWork,canSeeSale])
  const today=isoDay()
  const todayWork=useMemo(()=>work.filter(item=>item.date===today),[work,today])
  const todayEventSales=useMemo(()=>bookings.filter(item=>eventOnDay(item,today)),[bookings,today])
  const todayPrepSales=useMemo(()=>bookings.filter(item=>(item.prepDate||item.dateFrom||item.date)===today),[bookings,today])
  const workStats={today:todayWork.filter(x=>x.status!=='done').length,finish:todayWork.filter(x=>x.status==='da_finire').length,done:todayWork.filter(x=>x.status==='done').length}
  const saleStats={today:todayPrepSales.filter(x=>x.status!=='done').length,finish:todayPrepSales.filter(x=>x.status==='da_finire').length,done:todayPrepSales.filter(x=>x.status==='done').length}
  if(loading)return <Spinner label="Carico planning…"/>
  return <div data-testid="planning-hub">
    <div className="rs-page-title"><div><h1>Planning</h1><p>{section?(section==='sale'?'Preparazioni operative delle sale.':'Calendario operativo dei lavori.'):'Riepilogo di lavori e sale.'}</p></div>{section&&<button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setSection(null)}>‹ Riepilogo</button>}</div>
    <div style={{display:'grid',gridTemplateColumns:canSeeWork&&canSeeSale?'repeat(2,minmax(0,1fr))':'1fr',gap:10,marginBottom:16}}>{canSeeWork&&<PlanningChoice active={section==='work'} icon="wrench" title="Planning lavori" stats={workStats} onClick={()=>setSection('work')}/>} {canSeeSale&&<PlanningChoice active={section==='sale'} icon="calendar" title="Planning sale" stats={saleStats} onClick={()=>setSection('sale')}/>}</div>
    {!section?<div style={{display:'grid',gap:12}}>{canSeeWork&&<div style={{border:'1px solid var(--rs-line)',borderRadius:16,padding:14,background:'var(--rs-surface)'}}><strong>Lavori oggi</strong><p style={{margin:'6px 0 0',color:'var(--rs-text-2)'}}>{todayWork.length?`${todayWork.length} lavor${todayWork.length===1?'o':'i'} nel planning.`:'Nessun lavoro previsto oggi.'}</p></div>}{canSeeSale&&<><div style={{border:'1px solid var(--rs-line)',borderRadius:16,padding:14,background:'var(--rs-surface)'}}><strong>Sale oggi</strong><p style={{margin:'6px 0 0',color:'var(--rs-text-2)'}}>{todayEventSales.length?`${todayEventSales.length} attività/prenotazioni in corso oggi.`:'Nessuna sala occupata oggi.'}</p></div><SaleEventCalendar bookings={bookings}/></>}</div>:section==='work'&&canSeeWork?<PlanningWorkSimple hotel={hotel} user={user} openRequest={workCreateSignal}/>:section==='sale'&&canSeeSale?<PlanningSaleSimple hotel={hotel} user={user} openRequest={saleCreateSignal}/>:null}
    <PlannedCreateSheet open={interventionCreateOpen} onClose={()=>setInterventionCreateOpen(false)} hotel={hotel} user={user} onSaved={()=>setInterventionCreateOpen(false)}/>
  </div>
}
