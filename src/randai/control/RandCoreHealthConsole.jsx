import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { compareHealthChecks, normalizeHealthCheck } from '../core/health-snapshot.js'

const fmt = (value) => value ? new Date(value).toLocaleString('it-IT') : '—'
const tone = (status) => status === 'HEALTHY' ? 'good' : status === 'CRITICAL' ? 'bad' : status === 'DEGRADED' ? 'warn' : ''

export default function RandCoreHealthConsole(){
  const [data,setData]=useState(null)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')

  const load=useCallback(async()=>{
    if(!supabase)return
    setBusy(true);setNotice('')
    const {data:result,error}=await supabase.rpc('randcore_get_health_history',{p_limit:12})
    if(error)setNotice(error.message||'Storico RandCore non disponibile.')
    else setData(result)
    setBusy(false)
  },[])

  useEffect(()=>{load()},[load])

  const run=async()=>{
    if(!supabase||busy)return
    setBusy(true);setNotice('')
    const {error}=await supabase.rpc('randcore_run_health_check')
    if(error)setNotice(error.message||'Check manuale non riuscito.')
    else setNotice('Check RandCore completato e registrato.')
    setBusy(false);await load()
  }

  const checks=useMemo(()=>Array.isArray(data?.checks)?data.checks.map((item)=>normalizeHealthCheck({...item,findings:item.findings||[]})):[],[data])
  const latest=checks[0]||null
  const previous=checks[1]||null
  const drift=latest?compareHealthChecks(latest,previous):null
  const findings=Array.isArray(data?.findings)?data.findings:[]
  const coverage=latest?.snapshot?.coverage||{}

  return <div className="rc-health-console">
    <div className="rc-kpis">
      <article className="rc-kpi"><span>Stato RandCore</span><strong>{latest?.status||'UNKNOWN'}</strong><small>ultimo check completo registrato</small></article>
      <article className="rc-kpi"><span>Health score</span><strong>{latest?`${latest.score}/100`:'—'}</strong><small>evidence-based, non stimato</small></article>
      <article className="rc-kpi"><span>Copertura</span><strong>{coverage.measured_domains!=null?`${coverage.measured_domains}/${coverage.total_domains}`:'—'}</strong><small>domini con evidenza misurabile</small></article>
      <article className="rc-kpi"><span>Drift</span><strong>{drift?.direction||'BASELINE'}</strong><small>{drift?.scoreDelta==null?'nessun confronto':`${drift.scoreDelta>0?'+':''}${drift.scoreDelta} punti`}</small></article>
    </div>
    <section className="rc-panel"><header><strong>RandCore Health & Full Audit</strong><span>59–62</span></header><div className="rc-panel-body"><p>Il controllo periodico consolida salute DB, sicurezza e scheduler oggi misurabili. Deploy, backup, integrazioni e dipendenze restano marcati <b>UNKNOWN</b> finché non esiste evidenza automatica: RandCore non inventa uno stato verde.</p><div className="rc-chip-row"><span className={`rc-badge ${tone(latest?.status)}`}>{latest?.status||'Nessun check'}</span><span className="rc-badge">Ultimo {fmt(latest?.created_at)}</span><button onClick={run} disabled={busy}>{busy?'Controllo…':'Esegui check ora'}</button><button onClick={load} disabled={busy}>Aggiorna storico</button></div>{notice&&<div className="rc-notice">{notice}</div>}</div></section>
    <section className="rc-panel"><header><strong>Finding attuali</strong><span>{findings.length}</span></header><div className="rc-panel-body"><div className="rc-stack">{findings.map((item)=><article className="rc-row" key={item.id||item.fingerprint}><span><strong>{item.title||item.code}</strong><small>{item.category||'system'} · {item.detail||'nessun dettaglio'}</small></span><span className={`rc-badge ${item.severity==='CRITICAL'?'bad':item.severity==='HIGH'||item.severity==='WARN'?'warn':''}`}>{item.severity}</span></article>)}{!findings.length&&<div className="rc-empty">Nessun finding aperto nell’ultimo check.</div>}</div></div></section>
    <section className="rc-panel"><header><strong>Storico controlli</strong><span>{checks.length} snapshot</span></header><div className="rc-panel-body"><div className="rc-table-wrap"><table><thead><tr><th>Data</th><th>Sorgente</th><th>Stato</th><th>Score</th><th>Copertura</th></tr></thead><tbody>{checks.map((item)=><tr key={item.id}><td>{fmt(item.created_at)}</td><td>{item.source}</td><td><span className={`rc-badge ${tone(item.status)}`}>{item.status}</span></td><td>{item.score}/100</td><td>{item.snapshot?.coverage?.measured_domains??'—'}/{item.snapshot?.coverage?.total_domains??'—'}</td></tr>)}</tbody></table></div></div></section>
  </div>
}
