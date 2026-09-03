import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'

const fmt=(value)=>value?new Date(value).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'
const tone=(item)=>item.lifecycle_status==='forgotten'?'':item.trust==='approved'||item.trust==='verified'?'good':item.valid_until&&Date.parse(item.valid_until)<=Date.now()?'warn':''

export default function RandMindConsole({accessHotels=[],hotelFilter='all'}){
  const [snapshots,setSnapshots]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const hotels=useMemo(()=>hotelFilter==='all'?accessHotels:accessHotels.filter((id)=>id===hotelFilter),[accessHotels,hotelFilter])
  const load=useCallback(async()=>{
    if(!supabase||!hotels.length){setSnapshots([]);return}
    setBusy(true);setNotice('')
    try{
      const results=await Promise.all(hotels.map(async(hotelId)=>{
        const {data,error}=await supabase.rpc('randmind_get_console',{p_hotel_id:hotelId})
        if(error) throw error
        return data
      }))
      setSnapshots(results.filter(Boolean))
    }catch(error){setNotice(`RandMind non disponibile: ${error?.message||'errore'}`)}finally{setBusy(false)}
  },[hotels.join('|')])
  useEffect(()=>{load()},[load])
  const items=snapshots.flatMap((s)=>(s.items||[]).map((item)=>({...item,hotel_id:s.hotel_id})))
  const totals=snapshots.reduce((a,s)=>({total:a.total+Number(s.total||0),active:a.active+Number(s.active||0),verified:a.verified+Number(s.verified||0),stale:a.stale+Number(s.stale||0),forgotten:a.forgotten+Number(s.forgotten||0),conflicts:a.conflicts+(s.conflicts||[]).length}),{total:0,active:0,verified:0,stale:0,forgotten:0,conflicts:0})
  const forget=async(id)=>{
    const reason=window.prompt('Motivo della dimenticanza (audit obbligatorio):')
    if(!reason?.trim()) return
    setBusy(true);setNotice('')
    const {error}=await supabase.rpc('randmind_forget_memory',{p_memory_id:id,p_reason:reason.trim()})
    setBusy(false)
    if(error) setNotice(`Dimenticanza non riuscita: ${error.message}`); else {setNotice('Memoria disattivata e auditata.');await load()}
  }
  return <div className="rc-stack">
    <div className="rc-kpis"><article className="rc-kpi"><span>Memorie</span><strong>{totals.total}</strong><small>{totals.active} attive</small></article><article className="rc-kpi"><span>Verificate</span><strong>{totals.verified}</strong><small>verified / approved</small></article><article className="rc-kpi"><span>Stale</span><strong>{totals.stale}</strong><small>non usabili come verità corrente</small></article><article className={`rc-kpi ${totals.conflicts?'danger':''}`}><span>Conflitti</span><strong>{totals.conflicts}</strong><small>{totals.forgotten} dimenticate</small></article></div>
    {notice&&<div className="rc-notice">{notice}</div>}
    <section className="rc-panel"><header><strong>RandMind — memoria governata</strong><span>{busy?'Aggiornamento…':'provenienza · freshness · retention'}</span></header><div className="rc-panel-body"><p>La memoria non è verità operativa da sola: RandMind usa solo record attivi, non scaduti, con provenienza e qualità sufficienti. Le dimenticanze sono soft-delete auditabili; il legal hold non è eliminabile.</p><div className="rc-table-wrap"><table><thead><tr><th>Hotel</th><th>Memoria</th><th>Tipo</th><th>Trust</th><th>Confidence</th><th>Validità</th><th>Retention</th><th>Fonte</th><th></th></tr></thead><tbody>{items.map((m)=><tr key={m.id}><td>{m.hotel_id}</td><td><strong>{m.summary||m.content}</strong><small>{m.lifecycle_status}{m.conflict_group?` · conflitto ${m.conflict_group}`:''}</small></td><td>{m.type}</td><td><span className={`rc-badge ${tone(m)}`}>{m.trust}</span></td><td>{Math.round(Number(m.confidence||0)*100)}%</td><td>{fmt(m.valid_until)}</td><td>{m.retention_class}</td><td>{m.source_kind}:{m.source_id}</td><td>{m.lifecycle_status==='active'&&m.retention_class!=='legal_hold'&&<button onClick={()=>forget(m.id)} disabled={busy}>Dimentica</button>}</td></tr>)}</tbody></table></div>{!items.length&&!busy&&<div className="rc-empty">Nessuna memoria hotel-scoped disponibile.</div>}</div></section>
  </div>
}
