import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { compareHealthChecks, normalizeHealthCheck } from '../core/health-snapshot.js'
import { coerceHealthEvidenceSnapshot, RANDCORE_HEALTH_DOMAINS } from '../core/health-evidence.js'
import { getRandEcosystemManifest } from '../core/ecosystem.js'
import { buildModuleHealthSnapshot } from '../core/module-health.js'
import { buildRepoRadarSnapshot } from '../discovery/repo-radar.js'
import { REPO_RADAR_CATALOG } from '../discovery/repo-radar-catalog.js'

const fmt = (value) => value ? new Date(value).toLocaleString('it-IT') : '—'
const tone = (status) => status === 'HEALTHY' || status === 'STABLE' || status === 'VERIFIED' ? 'good' : status === 'CRITICAL' ? 'bad' : status === 'DEGRADED' || status === 'EVOLVING' || status === 'STALE' ? 'warn' : ''
const domainLabel = (value) => ({ database:'Database', security:'Sicurezza', workers:'Worker', deploy:'Deploy', backup_restore:'Backup/restore', integrations:'Integrazioni', dependencies:'Dipendenze' }[value] || value)

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

  const checks=useMemo(()=>Array.isArray(data?.checks)?data.checks.map((item)=>normalizeHealthCheck({...item,snapshot:coerceHealthEvidenceSnapshot(item.snapshot,{generatedAt:item.created_at}),findings:item.findings||[]})):[],[data])
  const latest=checks[0]||null
  const previous=checks[1]||null
  const drift=latest?compareHealthChecks(latest,previous):null
  const findings=Array.isArray(data?.findings)?data.findings:[]
  const coverage=latest?.snapshot?.coverage||{}
  const evidenceDomains=latest?.snapshot?.domains||{}
  const moduleHealth=useMemo(()=>buildModuleHealthSnapshot({modules:getRandEcosystemManifest(),repoSnapshot:buildRepoRadarSnapshot(REPO_RADAR_CATALOG),healthCheck:latest}),[latest?.id,latest?.status])

  return <div className="rc-health-console">
    <div className="rc-kpis">
      <article className="rc-kpi"><span>Stato RandCore</span><strong>{latest?.snapshot?.status||latest?.status||'UNKNOWN'}</strong><small>fail-closed su evidenza assente o stale</small></article>
      <article className="rc-kpi"><span>Health score</span><strong>{latest?`${latest.snapshot?.score??latest.score}/100`:'—'}</strong><small>solo domini verificati, non una copertura implicita</small></article>
      <article className="rc-kpi"><span>Copertura verificata</span><strong>{coverage.verified_domains!=null?`${coverage.verified_domains}/${coverage.total_domains}`:'—'}</strong><small>{coverage.evaluated_domains??RANDCORE_HEALTH_DOMAINS.length}/{coverage.total_domains??RANDCORE_HEALTH_DOMAINS.length} domini valutati</small></article>
      <article className="rc-kpi"><span>Confidence</span><strong>{latest?.snapshot?.confidence!=null?`${latest.snapshot.confidence}%`:'—'}</strong><small>{coverage.stale_domains||0} stale · {coverage.unknown_domains||0} unknown</small></article>
      <article className="rc-kpi"><span>Drift</span><strong>{drift?.direction||'BASELINE'}</strong><small>{drift?.scoreDelta==null?'nessun confronto':`${drift.scoreDelta>0?'+':''}${drift.scoreDelta} punti`}</small></article>
    </div>
    <section className="rc-panel"><header><strong>RandCore Health Evidence Contract</strong><span>71</span></header><div className="rc-panel-body"><p>I sette domini canonici sono sempre valutati: database, sicurezza, worker, deploy, backup/restore, integrazioni e dipendenze. Un dominio senza prova fresca resta <b>UNKNOWN</b>; uno stale non viene contato come verificato. Score, copertura e confidence restano separati.</p><div className="rc-chip-row"><span className={`rc-badge ${tone(latest?.snapshot?.status||latest?.status)}`}>{latest?.snapshot?.status||latest?.status||'Nessun check'}</span><span className="rc-badge">Ultimo {fmt(latest?.created_at)}</span><button onClick={run} disabled={busy}>{busy?'Controllo…':'Esegui check ora'}</button><button onClick={load} disabled={busy}>Aggiorna storico</button></div>{notice&&<div className="rc-notice">{notice}</div>}<div className="rc-stack">{RANDCORE_HEALTH_DOMAINS.map((domain)=>{const evidence=evidenceDomains[domain]||{};return <article className="rc-row" key={domain}><span><strong>{domainLabel(domain)}</strong><small>{evidence.source||'nessuna sorgente verificata'} · {evidence.checkedAt?fmt(evidence.checkedAt):'mai verificato'}</small></span><span className={`rc-badge ${tone(evidence.state)}`}>{evidence.state||'UNKNOWN'}</span></article>})}</div></div></section>
    <section className="rc-panel"><header><strong>Repo / Module Health</strong><span>66</span></header><div className="rc-panel-body"><div className="rc-kpis"><article className="rc-kpi"><span>Stato ecosistema</span><strong className={`rc-badge ${tone(moduleHealth.state)}`}>{moduleHealth.state}</strong><small>UNKNOWN non diventa healthy</small></article><article className="rc-kpi"><span>Moduli Live</span><strong>{moduleHealth.moduleCounts.LIVE||0}</strong><small>{moduleHealth.unfinished} da consolidare</small></article><article className="rc-kpi"><span>Repo KEEP</span><strong>{moduleHealth.repoCounts.KEEP||0}</strong><small>{moduleHealth.repoCounts.WATCH||0} in WATCH</small></article><article className="rc-kpi"><span>Repo REJECT</span><strong>{moduleHealth.repoCounts.REJECT||0}</strong><small>decisione ≠ installazione</small></article></div><p>La salute di un modulo deriva dalla Truth Map e dai check RandCore; la decisione Repo Radar resta separata dall’adozione.</p></div></section>
    <section className="rc-panel"><header><strong>Finding attuali</strong><span>{findings.length}</span></header><div className="rc-panel-body"><div className="rc-stack">{findings.map((item)=><article className="rc-row" key={item.id||item.fingerprint}><span><strong>{item.title||item.code}</strong><small>{item.category||'system'} · {item.detail||'nessun dettaglio'}</small></span><span className={`rc-badge ${item.severity==='CRITICAL'?'bad':item.severity==='HIGH'||item.severity==='WARN'?'warn':''}`}>{item.severity}</span></article>)}{!findings.length&&<div className="rc-empty">Nessun finding aperto nell’ultimo check.</div>}</div></div></section>
    <section className="rc-panel"><header><strong>Storico controlli</strong><span>{checks.length} snapshot</span></header><div className="rc-panel-body"><div className="rc-table-wrap"><table><thead><tr><th>Data</th><th>Sorgente</th><th>Stato</th><th>Score</th><th>Copertura</th><th>Confidence</th></tr></thead><tbody>{checks.map((item)=><tr key={item.id}><td>{fmt(item.created_at)}</td><td>{item.source}</td><td><span className={`rc-badge ${tone(item.snapshot?.status||item.status)}`}>{item.snapshot?.status||item.status}</span></td><td>{item.snapshot?.score??item.score}/100</td><td>{item.snapshot?.coverage?.verified_domains??'—'}/{item.snapshot?.coverage?.total_domains??'—'}</td><td>{item.snapshot?.confidence!=null?`${item.snapshot.confidence}%`:'—'}</td></tr>)}</tbody></table></div></div></section>
  </div>
}
