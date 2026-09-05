import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../planning-work-data.js'
import { fetchBookings, subscribeBookings } from '../sale-data.js'
import { canUser } from '../permissions.js'
import { Button, Spinner } from './ui.jsx'
import { Grid, PageTitle, Stack } from './randui/visual-primitives.jsx'
import PlanningWorkSimple from './PlanningWorkSimple.jsx'
import PlanningSaleSimple from './PlanningSaleSimple.jsx'
import PlannedCreateSheet from './PlannedCreateSheet.jsx'
import { PlanningChoice, PlanningTodaySummary, SaleEventCalendar, eventOnDay, isoDay } from './planning/PlanningOverview.jsx'

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
  const subtitle=section?(section==='sale'?'Preparazioni operative delle sale.':'Calendario operativo dei lavori.'):'Lavori, sale e attività di oggi.'
  const action=section?<Button type="button" variant="ghost" size="sm" onClick={()=>setSection(null)}>‹ Riepilogo</Button>:null
  return <Stack data-testid="planning-hub" className="rs-planning-hub" gap="sm">
    <PageTitle title="Planning" subtitle={subtitle} action={action}/>
    <Grid columns={canSeeWork&&canSeeSale?2:1} gap="sm" className="rs-planning-choice-grid">
      {canSeeWork&&<PlanningChoice active={section==='work'} icon="wrench" title="Planning lavori" stats={workStats} onClick={()=>setSection('work')}/>} 
      {canSeeSale&&<PlanningChoice active={section==='sale'} icon="calendar" title="Planning sale" stats={saleStats} onClick={()=>setSection('sale')}/>} 
    </Grid>
    {!section?<Stack gap="sm" className="rs-planning-overview-stack">
      <PlanningTodaySummary workCount={todayWork.length} saleCount={todayEventSales.length} showWork={canSeeWork} showSale={canSeeSale}/>
      {canSeeSale&&<SaleEventCalendar bookings={bookings}/>} 
    </Stack>:section==='work'&&canSeeWork?<PlanningWorkSimple hotel={hotel} user={user} openRequest={workCreateSignal}/>:section==='sale'&&canSeeSale?<PlanningSaleSimple hotel={hotel} user={user} openRequest={saleCreateSignal}/>:null}
    <PlannedCreateSheet open={interventionCreateOpen} onClose={()=>setInterventionCreateOpen(false)} hotel={hotel} user={user} onSaved={()=>setInterventionCreateOpen(false)}/>
  </Stack>
}
