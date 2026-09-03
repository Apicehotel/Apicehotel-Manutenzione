import { getRandEcosystemManifest, summarizeRandEcosystem } from '../core/ecosystem.js'

const LABEL={LIVE:'Live',BACKEND_ONLY:'Solo motore',PARTIAL:'Parziale',PLANNED:'Pianificato',ZOMBIE:'Zombie'}
const TONE={LIVE:'good',BACKEND_ONLY:'warn',PARTIAL:'warn',PLANNED:'',ZOMBIE:'bad'}

export default function EcosystemConsole(){
  const modules=getRandEcosystemManifest()
  const summary=summarizeRandEcosystem(modules)
  return <div className="rc-ecosystem">
    <div className="rc-kpis"><article className="rc-kpi"><span>Moduli censiti</span><strong>{summary.total}</strong><small>mappa canonica</small></article><article className="rc-kpi"><span>Live</span><strong>{summary.counts.LIVE}</strong><small>con evidenza nel repository</small></article><article className="rc-kpi"><span>Da consolidare</span><strong>{summary.unfinished}</strong><small>partial / planned / backend-only</small></article><article className="rc-kpi"><span>Zombie dichiarati</span><strong>{summary.counts.ZOMBIE}</strong><small>nessuna eliminazione automatica</small></article></div>
    <section className="rc-panel"><header><strong>Rand Ecosystem Truth Map</strong><span>codice, non marketing</span></header><div className="rc-panel-body"><p>Uno stato <b>Live</b> richiede evidenza canonica. “Parziale” significa che esistono capability reali ma il modulo dedicato non è ancora consolidato. “Pianificato” non viene presentato come implementato.</p><div className="rc-ecosystem-grid">{modules.map((module)=><article className="rc-ecosystem-card" key={module.id}><header><div><small>{module.phase}</small><h3>{module.name}</h3></div><span className={`rc-badge ${TONE[module.status]||''}`}>{LABEL[module.status]||module.status}</span></header><p>{module.description}</p><div className="rc-evidence"><strong>Evidenze</strong>{module.evidence.length?module.evidence.map((path)=><code key={path}>{path}</code>):<span>Nessuna evidenza runtime dichiarata.</span>}</div></article>)}</div></div></section>
  </div>
}
