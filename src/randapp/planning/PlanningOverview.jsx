import { useState } from 'react'
import { Icon } from '../ui.jsx'
import { Grid, Metric, Surface } from '../randui/visual-primitives.jsx'

const WD=['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
const MONTHS=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
const SHIFTS={mattina:'Mattina',pomeriggio:'Pomeriggio',tutto_giorno:'Giornata intera'}
export const isoDay=(value=new Date())=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const addDays=(value,n)=>{const d=new Date(value);d.setDate(d.getDate()+n);return d}
const startOfWeek=(value)=>{const d=new Date(value);const offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);d.setHours(12,0,0,0);return d}
const shortDate=(value)=>`${value.getDate()} ${MONTHS[value.getMonth()]}`
export const eventOnDay=(item,date)=>(item.dateFrom||item.date)<=date&&(item.dateTo||item.date)>=date

export function PlanningChoice({active,icon,title,stats,onClick}){return <button type="button" onClick={onClick} aria-pressed={active} className={`rs-randui-choice ${active?'is-active':''}`}><div className="rs-randui-choice__head"><span className="rs-randui-choice__icon"><Icon name={icon}/></span><strong>{title}</strong><span className="rs-randui-choice__chevron">›</span></div><Grid columns={3} gap="xs" className="rs-randui-grid--keep-mobile"><Metric compact value={stats.today} label="Oggi"/><Metric compact value={stats.finish} label="Da finire" tone="warning"/><Metric compact value={stats.done} label="Fatti oggi" tone="success"/></Grid></button>}

export function SaleEventCalendar({bookings}){
  const [anchor,setAnchor]=useState(()=>new Date())
  const today=isoDay(),weekStart=startOfWeek(anchor),days=Array.from({length:7},(_,i)=>addDays(weekStart,i)),weekEnd=days[6]
  return <Surface className="rs-randui-calendar">
    <header className="rs-randui-calendar__header"><div className="rs-randui-calendar__header-copy"><strong>Calendario sale</strong><p>Quando le sale sono occupate: qui conta la data dell'evento.</p></div><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(new Date())}>Oggi</button></header>
    <div className="rs-randui-calendar__nav"><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(d=>addDays(d,-7))}>‹</button><div className="rs-randui-calendar__range">{shortDate(days[0])} – {shortDate(weekEnd)}</div><button type="button" className="rs-btn rs-btn--ghost" onClick={()=>setAnchor(d=>addDays(d,7))}>›</button></div>
    <div className="rs-randui-calendar__days">{days.map(day=>{const date=isoDay(day),rows=bookings.filter(b=>eventOnDay(b,date));return <div key={date} className="rs-randui-calendar__day" data-today={date===today||undefined}><div className="rs-randui-calendar__date"><strong className="rs-randui-calendar__weekday">{WD[day.getDay()]}</strong><span className="rs-randui-calendar__day-number">{day.getDate()}</span></div><div className="rs-randui-calendar__events">{rows.length?rows.map(b=><article key={`${b.id}-${date}`} className="rs-randui-calendar__event"><div className="rs-randui-calendar__event-head"><strong>{b.room}</strong><small>{SHIFTS[b.shift]||b.shift}</small></div><span>{b.client}{b.layout?` · ${b.layout}`:''}{b.pax?` · ${b.pax} PAX`:''}</span>{b.dateTo&&b.dateTo!==b.dateFrom&&<small>Evento {b.dateFrom} → {b.dateTo}</small>}</article>):<span className="rs-randui-calendar__empty">Nessuna sala occupata.</span>}</div></div>})}</div>
  </Surface>
}
