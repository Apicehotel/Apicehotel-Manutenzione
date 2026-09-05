import { useEffect, useState } from 'react'
import { deleteBookingRow, fetchBookings, subscribeBookings } from '../sale-data.js'
import { fetchSaleRooms, subscribeSaleRooms } from '../sale-config-data.js'
import { fetchSaleClients, fetchSaleLayouts } from '../sale-directory-data.js'
import { Button } from './ui.jsx'
import { Grid, Metric, Stack, Surface } from './randui/visual-primitives.jsx'
import PlanningDateNavigator from './planning/PlanningDateNavigator.jsx'
import SaleBookingCard from './planning/SaleBookingCard.jsx'
import SaleBookingForm from './planning/SaleBookingForm.jsx'
import SaleRoomConfigSheet from './planning/SaleRoomConfigSheet.jsx'
import { addDays, canManageSalePlanning, canOperateSalePlanning, dayLabel, iso } from './planning/sale-utils.js'

export { canManageSalePlanning, canOperateSalePlanning } from './planning/sale-utils.js'

export default function PlanningSaleSimple({hotel,user,openRequest=0}){
  const [bookings,setBookings]=useState([]),[rooms,setRooms]=useState([]),[clients,setClients]=useState([]),[layouts,setLayouts]=useState([]),[anchor,setAnchor]=useState(()=>new Date()),[view,setView]=useState('giorno'),[creating,setCreating]=useState(false),[editing,setEditing]=useState(null),[configOpen,setConfigOpen]=useState(false),[error,setError]=useState('')
  const director=canManageSalePlanning(user),allowed=canOperateSalePlanning(user)
  const load=async()=>{if(!allowed)return;try{setError('');const tasks=[fetchBookings(hotel.id),fetchSaleRooms(hotel.id,{includeInactive:director})];if(director)tasks.push(fetchSaleClients(hotel.id),fetchSaleLayouts(hotel.id));const data=await Promise.all(tasks);setBookings(data[0].items||[]);setRooms(data[1]||[]);if(director){setClients(data[2]||[]);setLayouts(data[3]||[])}}catch(err){setError(err?.message||'Planning sale non disponibile')}}
  useEffect(()=>{if(!allowed)return;load();const offBookings=subscribeBookings(hotel.id,load),offRooms=subscribeSaleRooms(hotel.id,load);return()=>{offBookings?.();offRooms?.()}},[hotel.id,allowed,director])
  useEffect(()=>{if(openRequest&&director)setCreating(true)},[openRequest,director])
  if(!allowed)return <p className="rs-randui-emptyline">Planning sale non disponibile per questo ruolo.</p>
  const count=view==='giorno'?1:7,days=Array.from({length:count},(_,i)=>addDays(anchor,i)),today=iso(),todayRows=bookings.filter(b=>(b.prepDate||b.dateFrom||b.date)===today),stats={today:todayRows.filter(b=>b.status!=='done').length,finish:todayRows.filter(b=>b.status==='da_finire').length,done:todayRows.filter(b=>b.status==='done').length}
  const remove=async b=>{if(!director||!window.confirm(`Eliminare la prenotazione di “${b.client}”?`))return;await deleteBookingRow(b.id,hotel.id);await load()}
  const periodLabel=view==='giorno'?dayLabel(anchor):`${dayLabel(days[0])} – ${dayLabel(days[6])}`
  return <Stack>
    <Surface tone="subtle"><strong>Preparazioni sale</strong><p className="rs-randui-surface__description">Qui compaiono nel giorno stabilito dal Direttore Centro Congressi. Le date evento restano nel calendario della schermata Planning.</p></Surface>
    <Grid columns={3} gap="sm" className="rs-randui-grid--keep-mobile"><Metric value={stats.today} label="Oggi"/><Metric value={stats.finish} label="Da finire" tone="warning"/><Metric value={stats.done} label="Fatti oggi" tone="success"/></Grid>
    {director&&<div className="rs-randui-action-row"><Button type="button" variant="ghost" icon="gear" onClick={()=>setConfigOpen(true)}>Configura sale</Button></div>}
    <Grid columns={2} gap="sm" className="rs-randui-grid--keep-mobile"><Button type="button" variant={view==='giorno'?'primary':'ghost'} onClick={()=>setView('giorno')}>Giorno</Button><Button type="button" variant={view==='settimana'?'primary':'ghost'} onClick={()=>setView('settimana')}>Settimana</Button></Grid>
    <PlanningDateNavigator label={periodLabel} onPrevious={()=>setAnchor(d=>addDays(d,view==='giorno'?-1:-7))} onNext={()=>setAnchor(d=>addDays(d,view==='giorno'?1:7))} onToday={()=>setAnchor(new Date())}/>
    {error&&<p className="rs-randui-errorline">{error}</p>}
    <Stack>{days.map(day=>{const date=iso(day),list=bookings.filter(b=>(b.prepDate||b.dateFrom||b.date)===date);return <section key={date} className="rs-randui-day" data-today={date===today||undefined}><h3 className="rs-randui-day__title">{dayLabel(day)}{date===today?' · oggi':''}</h3>{list.length?list.map(b=><Stack key={b.id} gap="xs"><SaleBookingCard booking={b} user={user} onRefresh={load} onEdit={setEditing}/>{director&&<Button type="button" variant="danger" size="sm" className="rs-randui-self-end" onClick={()=>remove(b)}>Elimina</Button>}</Stack>):<p className="rs-randui-emptyline">Nessuna sala da preparare.</p>}</section>})}</Stack>
    <SaleBookingForm open={creating||Boolean(editing)} onClose={()=>{setCreating(false);setEditing(null)}} hotel={hotel} user={user} bookings={bookings} rooms={rooms} clients={clients} layouts={layouts} initial={editing} onSaved={load} onDirectoryChanged={load}/>
    {director&&<SaleRoomConfigSheet open={configOpen} onClose={()=>setConfigOpen(false)} hotel={hotel} rooms={rooms} onSaved={load}/>} 
  </Stack>
}
