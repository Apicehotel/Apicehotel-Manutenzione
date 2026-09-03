import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'

const tone = (bad) => bad ? 'bad' : 'good'

export default function RandSecurityConsole(){
  const [data,setData]=useState(null)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')

  const load=useCallback(async()=>{
    if(!supabase)return
    setBusy(true);setNotice('')
    const {data:result,error}=await supabase.rpc('randcore_security_snapshot')
    if(error)setNotice(error.message||'Security Center non disponibile.')
    else setData(result)
    setBusy(false)
  },[])

  useEffect(()=>{load()},[load])

  const exposed=useMemo(()=>Array.isArray(data?.functions)?data.functions.filter((item)=>item.anon_execute||(item.authenticated_execute&&['TRIGGER','INTERNAL_WORKER'].includes(item.kind))):[],[data])
  const anonCount=Number(data?.anon_security_definer_count||0)
  const internalCount=Number(data?.internal_authenticated_exposure_count||0)

  return <section className="rc-panel">
    <header><strong>Rand Security Center</strong><span>64 · least privilege</span></header>
    <div className="rc-panel-body">
      <div className="rc-kpis">
        <article className="rc-kpi"><span>SECURITY DEFINER anon</span><strong>{data?anonCount:'—'}</strong><small>deve essere 0</small></article>
        <article className="rc-kpi"><span>Interni esposti authenticated</span><strong>{data?internalCount:'—'}</strong><small>trigger / worker interni</small></article>
        <article className="rc-kpi"><span>Finding aperti</span><strong>{data?exposed.length:'—'}</strong><small>solo esposizioni verificabili</small></article>
        <article className="rc-kpi"><span>Postura ACL</span><strong className={`rc-badge ${tone(anonCount||internalCount)}`}>{data?(anonCount||internalCount?'ATTENZIONE':'HARDENED'):'UNKNOWN'}</strong><small>nessun verde senza evidenza</small></article>
      </div>
      <p>Il Security Center mostra solo esposizioni misurate. Le funzioni interne non devono essere richiamabili dal browser; le RPC operative mantengono esclusivamente i ruoli necessari.</p>
      <div className="rc-chip-row"><button onClick={load} disabled={busy}>{busy?'Verifico…':'Verifica ACL ora'}</button></div>
      {notice&&<div className="rc-notice">{notice}</div>}
      <div className="rc-stack">{exposed.map((item)=><article className="rc-row" key={`${item.name}-${item.args}`}><span><strong>{item.name}</strong><small>{item.kind} · {item.args||'nessun argomento'}</small></span><span className="rc-badge bad">{item.anon_execute?'ANON EXECUTE':'AUTH INTERNAL'}</span></article>)}{data&&!exposed.length&&<div className="rc-empty">Nessuna esposizione critica rilevata.</div>}</div>
    </div>
  </section>
}
