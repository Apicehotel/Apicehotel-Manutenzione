import { BrainAutonomyLevel } from '../randbrain/contracts.js'

const LEVELS=[
  [BrainAutonomyLevel.READ_ONLY,'Solo lettura','Nessuna azione operativa.'],
  [BrainAutonomyLevel.SUGGEST,'Suggerisci','Produce piano e proposta, senza eseguire.'],
  [BrainAutonomyLevel.SAFE_EXECUTE,'Esegui sicuro','Solo azioni a basso rischio e solo attraverso Action Gateway.'],
  [BrainAutonomyLevel.APPROVAL_REQUIRED,'Approvazione','Si ferma finché un umano autorizzato non approva.'],
]
export default function RandBrainConsole(){return <section className="rc-panel"><header><strong>RandBrain</strong><span>orchestrazione superiore governata</span></header><div className="rc-panel-body"><p>RandBrain compone Supervisor, Agents, Autonomy e Learning esistenti. RandCore/RLS/RPC/Action Gateway restano l'autorità: il cervello non ottiene privilegi propri.</p><div className="rc-card-grid">{LEVELS.map(([id,title,text])=><article className="rc-kpi" key={id}><span>{id}</span><strong>{title}</strong><small>{text}</small></article>)}</div><p><b>Flusso canonico:</b> problema → evidenze verificate → ipotesi → piano → autorizzazione → verifica → recovery. Gli esiti possono alimentare Learning solo quando sono verificati.</p></div></section>}
