import { evaluateVikingProductionGate } from '../viking/production-gate.js'

export default function VikingConsole(){
  const gate=evaluateVikingProductionGate()
  const evaluation=gate.evaluation
  return <section className="rc-panel"><header><strong>Viking Evaluation</strong><span>punto 99 · {gate.status}</span></header><div className="rc-panel-body"><p>OpenViking è stato valutato con Repo Radar. Il runtime completo non viene installato: duplicherebbe memoria, conoscenza, skill e retrieval già governati da RandMind, RandGuide e Skill Engine.</p><div className="rc-card-grid"><article className="rc-kpi"><span>Decisione</span><strong>Pattern only</strong><small>nessuna nuova autorità</small></article><article className="rc-kpi"><span>Runtime esterno</span><strong>Bloccato</strong><small>Python, DB e credenziali evitati</small></article><article className="rc-kpi"><span>Pattern adottati</span><strong>{evaluation.adoptablePatterns.length}</strong><small>L0/L1/L2 + retrieval trace</small></article><article className="rc-kpi"><span>Rollback</span><strong>Immediato</strong><small>proiezione stateless</small></article></div><p><b>Autorità conservate:</b> {evaluation.canonicalAuthorities.join(' · ')}. La proiezione è hotel-scoped, usa soltanto evidenze autorizzate e non persiste un secondo indice.</p></div></section>
}
