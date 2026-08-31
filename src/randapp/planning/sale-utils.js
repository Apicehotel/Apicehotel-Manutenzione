import { canUser } from '../../permissions.js'
import { WEEKDAYS, addDays, iso } from './date-utils.js'

export { addDays, iso } from './date-utils.js'

export const SHIFTS={mattina:'Mattina',pomeriggio:'Pomeriggio',tutto_giorno:'Giornata intera'}
export const WD=WEEKDAYS
export const GROUPS=['trumpet','sax','auditorium']
export const norm=(v='')=>String(v).trim().toLocaleLowerCase('it')
export const canManageSalePlanning=(user)=>canUser(user,'planning_sale','manage')||canUser(user,'planning_sale','edit')||canUser(user,'planning_sale','delete')
export const canOperateSalePlanning=(user)=>canUser(user,'planning_sale','view')
export const parseIso=(value)=>new Date(`${value}T12:00:00`)
export const dayLabel=(value)=>`${WD[value.getDay()]} ${String(value.getDate()).padStart(2,'0')}/${String(value.getMonth()+1).padStart(2,'0')}`
const overlaps=(aFrom,aTo,bFrom,bTo)=>aFrom<=bTo&&aTo>=bFrom
export function roomIndex(rooms){const byKey=new Map(),byName=new Map();rooms.forEach(r=>{byKey.set(r.key,r);byName.set(r.name,r)});return{byKey,byName}}
export function roomForBooking(b,index){return(b.roomKey&&index.byKey.get(b.roomKey))||index.byName.get(b.room)||null}
function shareParts(a,b){return Boolean(a&&b&&(a.parts||[]).some(p=>(b.parts||[]).includes(p)))}
export function roomAvailability(room,dateFrom,dateTo,shift,bookings,index,excludeId=null){const rows=bookings.filter(i=>i.id!==excludeId&&overlaps(i.dateFrom||i.date,i.dateTo||i.date,dateFrom,dateTo)).filter(i=>{const booked=roomForBooking(i,index);return booked?shareParts(booked,room):i.room===room.name});const morning=rows.some(i=>i.shift==='mattina'||i.shift==='tutto_giorno'),afternoon=rows.some(i=>i.shift==='pomeriggio'||i.shift==='tutto_giorno');if(shift==='mattina')return morning?'busy':'free';if(shift==='pomeriggio')return afternoon?'busy':'free';if(morning&&afternoon)return'busy';if(morning||afternoon)return'partial';return'free'}
