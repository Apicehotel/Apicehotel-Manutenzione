import { useMemo, useState } from 'react'
import { REPO_RADAR_CATALOG } from '../discovery/repo-radar-catalog.js'
import { buildRepoRadarSnapshot } from '../discovery/repo-radar.js'

const ORDER=['ADD','REPLACE','UPGRADE','KEEP','WATCH','REJECT']
const tone={ADD:'good',REPLACE:'good',UPGRADE:'good',KEEP:'neutral',WATCH:'warn',REJECT:'bad'}

export default function RepoRadarConsole(){
  const [decision,setDecision]=useState('ALL')
  const snapshot=useMemo(()=>buildRepoRadarSnapshot(REPO_RADAR_CATALOG),[])
  const visible=snapshot.candidates.filter((item)=>decision==='ALL'||item.decision===decision)
  return <section className="rc-ecosystem" aria-label="Repo Radar">
    <div className="rc-kpis">
      <article className="rc-kpi"><span>Candidate governate</span><strong>{snapshot.candidates.length}</strong><small>stelle solo discovery</small></article>
      <article className="rc-kpi"><span>Aggiungi</span><strong>{snapshot.counts.ADD}</strong><small>gate completi</small></article>
      <article className="rc-kpi"><span>Watch</span><strong>{snapshot.counts.WATCH}</strong><small>evidenze incomplete</small></article>
      <article className="rc-kpi"><span>Reject</span><strong>{snapshot.counts.REJECT}</strong><small>blocco esplicito</small></article>
    </div>
    <div className="rc-toolbar"><select value={decision} onChange={(e)=>setDecision(e.target.value)} aria-label="Filtro decisione Repo Radar"><option value="ALL">Tutte le decisioni</option>{ORDER.map((value)=><option key={value} value={value}>{value}</option>)}</select><span className="rc-badge">Weekly discovery: GitHub Actions</span><span className="rc-badge good">Auto-install OFF</span></div>
    <div className="rc-ecosystem-grid">{visible.map((item)=><article className="rc-ecosystem-card" key={item.id}><header><div><small>{item.repository.replace('https://github.com/','')}</small><h3>{item.name}</h3></div><span className={`rc-badge ${tone[item.decision]||''}`}>{item.decision}</span></header><p>{item.note||item.reason}</p><div className="rc-evidence"><span>Score tecnico <strong>{Math.round(item.score*100)}%</strong></span><span>Motivo: {item.reason}</span><span>Security {Math.round(item.evidence.security*100)} · Compatibilità {Math.round(item.evidence.compatibility*100)} · Manutenibilità {Math.round(item.evidence.maintainability*100)}</span><span>Gate: S {item.gates.security} · C {item.gates.compatibility} · B {item.gates.benchmark} · R {item.gates.rollback}</span>{item.blockers.length>0&&<span>Blocchi: {item.blockers.join(', ')}</span>}<a href={item.repository} target="_blank" rel="noreferrer">Apri repository ↗</a></div></article>)}</div>
    <p className="rc-note">La console mostra il catalogo governato; lo scouting settimanale cerca anche nuove repository e le mantiene WATCH finché una deep review non completa i gate. ADD/REPLACE/UPGRADE non installano nulla automaticamente.</p>
  </section>
}
