import { useEffect, useState } from 'react'
import { Icon, Sheet } from '../ui.jsx'
import { GROUPS, norm, roomAvailability } from './sale-utils.js'

export default function SaleRoomPicker({open,onClose,rooms,bookings,draft,index,selectedKey,onSelect,excludeId}){
  const [query,setQuery]=useState('')
  useEffect(()=>{if(open)setQuery('')},[open])
  const statusFor=r=>roomAvailability(r,draft.dateFrom,draft.dateTo,draft.shift,bookings,index,excludeId)
  const filtered=rooms.filter(r=>r.active&&(!query||norm(r.name).includes(norm(query))))
  const singles=filtered.filter(r=>!GROUPS.includes(norm(r.family)))
  const grouped=GROUPS.map(g=>({key:g,items:filtered.filter(r=>norm(r.family)===g)})).filter(g=>g.items.length)
  const freeCount=filtered.filter(r=>statusFor(r)==='free').length
  const pick=r=>{if(statusFor(r)!=='free')return;onSelect(r.key);onClose()}
  const roomButton=r=>{const status=statusFor(r),active=r.key===selectedKey,color=status==='free'?'var(--rs-ok)':status==='partial'?'var(--rs-warn)':'#e35d6a';return <button type="button" key={r.key} disabled={status!=='free'} onClick={()=>pick(r)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,minHeight:46,padding:'9px 11px',border:`1px solid ${active?'var(--rs-cyan)':'var(--rs-line)'}`,borderRadius:13,background:active?'color-mix(in srgb,var(--rs-cyan) 11%,var(--rs-surface))':'var(--rs-surface)',color:'var(--rs-text)',opacity:status==='busy'?.5:1,textAlign:'left'}}><span style={{fontWeight:750,minWidth:0}}>{r.name}</span><small style={{color,whiteSpace:'nowrap'}}>{status==='free'?'● Libera':status==='partial'?'◐ Parziale':'● Occupata'}</small></button>}
  return <Sheet open={open} onClose={onClose} className="rs-sale-sheet"><div style={{display:'grid',gap:12}}><header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><h2 style={{margin:0,fontFamily:'Sora'}}>Scegli sala</h2><small style={{color:'var(--rs-text-3)'}}>{freeCount} sale libere nel periodo dell'evento</small></div><button type="button" className="rs-iconbtn" onClick={onClose}><Icon name="close"/></button></header><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca sala…" style={{minHeight:44,border:'1px solid var(--rs-line)',borderRadius:13,padding:'0 12px',background:'var(--rs-surface)',color:'var(--rs-text)'}}/>{singles.length>0&&<section style={{display:'grid',gap:7}}><strong>Sale singole</strong>{singles.map(roomButton)}</section>}{grouped.map(group=><section key={group.key} style={{display:'grid',gap:7}}><strong style={{textTransform:'capitalize'}}>{group.key}</strong><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:7}}>{group.items.map(roomButton)}</div></section>)}</div></Sheet>
}
