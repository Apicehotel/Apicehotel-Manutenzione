import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../planning-work-data.js'
import { fetchBookings, subscribeBookings } from '../sale-data.js'
import { withTimeout } from '../async-timeout.js'
import { canUser } from '../permissions.js'
import { Button, Spinner } from './ui.jsx'
import PlanningWorkSimple from './PlanningWorkSimple.jsx'
import PlanningSaleSimple from './PlanningSaleSimple.jsx'
import { PlanningChoice, PlanningTodaySummary, SaleEventCalendar, eventOnDay, isoDay } from './planning/PlanningOverview.jsx'
import { putViewCache, takeViewCache } from './view-session-cache.js'

export default function PlanningHub({hotel,user,createRequest=null,allowSale=true,onSectionChange,onCreateRequestConsumed}){
  const cacheKey = `planning:${hotel.id}`
  const warm = takeViewCache(cacheKey)
  const [section,setSection]=useState(null)
  const [work,setWork]=useState(() => (Array.isArray(warm?.work) ? warm.work : []))
  const [bookings,setBookings]=useState(() => (Array.isArray(warm?.bookings) ? warm.bookings : []))
  const [loading,setLoading]=useState(() => !(warm && ((warm.work?.length) || (warm.bookings?.length))))
  const [workCreateSignal,setWorkCreateSignal]=useState(0)
  const [saleCreateSignal,setSaleCreateSignal]=useState(0)
  const canSeeWork=canUser(user,'planning_work','view')
  const canSeeSale=allowSale&&canUser(user,'planning_sale','view')
  const load=useCallback(async({soft=false}={})=>{
    if(!soft) setLoading(true)
    try{
      const [workItems,sales]=await withTimeout(Promise.all([
        canSeeWork?fetchPlanningWork(hotel.id):Promise.resolve([]),
        canSeeSale?fetchBookings(hotel.id):Promise.resolve({items:[]}),
      ]),20000,'Planning timeout')
      const nextWork=workItems||[]
      const nextBookings=sales.items||[]
      setWork(nextWork)
      setBookings(nextBookings)
      putViewCache(cacheKey,{work:nextWork,bookings:nextBookings})
    }catch(error){
      console.warn('Caricamento planning fallito',error)
    }finally{
      setLoading(false)
    }
  },[hotel.id,canSeeWork,canSeeSale,cacheKey])
  useEffect(()=>{
    let cancelled=false
    setSection(null)
    ;(async()=>{
      const sessionWarm=takeViewCache(cacheKey)
      if(sessionWarm&&((sessionWarm.work?.length)||(sessionWarm.bookings?.length))){
        setWork(sessionWarm.work||[])
        setBookings(sessionWarm.bookings||[])
        setLoading(false)
      }
      if(!cancelled) await load({soft:true})
    })()
    const offWork=canSeeWork?subscribePlanningWork(hotel.id,()=>{void load({soft:true})}):null
    const offSales=canSeeSale?subscribeBookings(hotel.id,()=>{void load({soft:true})}):null
    return()=>{cancelled=true;offWork?.();offSales?.()}
  },[hotel.id,load,canSeeWork,canSeeSale,cacheKey])
  useEffect(()=>{if(!createRequest?.nonce)return;let consumed=false;if(createRequest.kind==='work'&&canSeeWork){setSection('work');onSectionChange?.('work');setWorkCreateSignal(n=>n+1);consumed=true}if(createRequest.kind==='sale'&&canSeeSale){setSection('sale');onSectionChange?.('sale');setSaleCreateSignal(n=>n+1);consumed=true}if(consumed)onCreateRequestConsumed?.(createRequest.kind)},[createRequest?.nonce,createRequest?.kind,canSeeWork,canSeeSale,onSectionChange,onCreateRequestConsumed])
  const chooseSection=(next)=>{setSection(next);onSectionChange?.(next)}
  const today=isoDay()
  const todayWork=useMemo(()=>work.filter(item=>item.date===today),[work,today])
  const todayEventSales=useMemo(()=>bookings.filter(item=>eventOnDay(item,today)),[bookings,today])
  const todayPrepSales=useMemo(()=>bookings.filter(item=>(item.prepDate||item.dateFrom||item.date)===today),[bookings,today])
  const workStats={today:todayWork.filter(x=>x.status!=='done').length,finish:todayWork.filter(x=>x.status==='da_finire').length,done:todayWork.filter(x=>x.status==='done').length}
  const saleStats={today:todayPrepSales.filter(x=>x.status!=='done').length,finish:todayPrepSales.filter(x=>x.status==='da_finire').length,done:todayPrepSales.filter(x=>x.status==='done').length}
  if(loading)return <Spinner label="Carico planning…"/>
  const subtitle=section?(section==='sale'?'Preparazioni operative delle sale.':'Calendario operativo dei lavori.'):'Lavori, sale e attività di oggi.'
  return (
    <section className="rv2-page rv2-planning" data-testid="planning-hub">
      <header className="rv2-pagehead rv2-pagehead--action">
        <div><span className="rv2-eyebrow">Planning</span><h1>Planning</h1><p>{subtitle}</p></div>
        {section ? <Button type="button" variant="ghost" size="sm" onClick={()=>chooseSection(null)}>‹ Riepilogo</Button> : null}
      </header>

      <div className="rv2-choice-grid" data-columns={canSeeWork&&canSeeSale?2:1}>
        {canSeeWork&&<PlanningChoice active={section==='work'} icon="wrench" title="Planning lavori" stats={workStats} onClick={()=>chooseSection('work')}/>}
        {canSeeSale&&<PlanningChoice active={section==='sale'} icon="calendar" title="Planning sale" stats={saleStats} onClick={()=>chooseSection('sale')}/>}
      </div>

      <div className="rv2-planning-body">
        {!section ? <>
          <PlanningTodaySummary workCount={todayWork.length} saleCount={todayEventSales.length} showWork={canSeeWork} showSale={canSeeSale}/>
          {canSeeSale&&<SaleEventCalendar bookings={bookings}/>}
        </> : section==='work'&&canSeeWork ? <PlanningWorkSimple hotel={hotel} user={user} openRequest={workCreateSignal}/> : section==='sale'&&canSeeSale ? <PlanningSaleSimple hotel={hotel} user={user} openRequest={saleCreateSignal}/> : null}
      </div>
    </section>
  )
}
