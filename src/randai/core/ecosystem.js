export const EcosystemStatus = Object.freeze({
  LIVE: 'LIVE',
  BACKEND_ONLY: 'BACKEND_ONLY',
  PARTIAL: 'PARTIAL',
  PLANNED: 'PLANNED',
  ZOMBIE: 'ZOMBIE',
})

const MODULES = Object.freeze([
  { id:'randapp', name:'RandApp', status:EcosystemStatus.LIVE, phase:'OPERATIONS', evidence:['src/randapp/App.jsx','src/randapp/Shell.jsx'], description:'Applicazione operativa multi-hotel.' },
  { id:'randai', name:'RandAI', status:EcosystemStatus.LIVE, phase:'AI', evidence:['src/randai/RandAIAssistant.jsx','src/randai/auth/RandAIProtectedRoute.jsx'], description:'Assistente, runtime e control surface AI.' },
  { id:'randcore', name:'RandCore', status:EcosystemStatus.LIVE, phase:'CORE', evidence:['src/randai/core/orchestrator.js','src/randai/core/health-snapshot.js','src/randai/action-gateway.js','src/reliability/release-gate.js'], description:'Contratti, governance e health audit canonici; non sostituisce RLS/RPC.' },
  { id:'randcontrol', name:'RandControl', status:EcosystemStatus.LIVE, phase:'CONTROL', evidence:['src/randai/control/RandAIControlCenter.jsx','src/randai/control/RandCoreHealthConsole.jsx','src/randai/control-center/engine.js'], description:'Control Center amministrativo, health history e proiezione governance.' },
  { id:'randguide', name:'RandGuide', status:EcosystemStatus.LIVE, phase:'KNOWLEDGE', evidence:['src/randai/guidance/catalog.js','src/randai/guidance/authoring.js','src/randai/guidance/ingestion.js','src/randai/guidance/graph.js','src/randai/guidance/engine.js','src/randai/console/RandAIConsole.jsx','supabase/migrations/20260903213000_randguide_live_74_80.sql','test/randai-block22-randguide-74-80.test.js'], description:'Prodotto canonico di conoscenza operativa: procedure versionate, fonti/provenance, knowledge graph, guida step-by-step e governance hotel-scoped.' },
  { id:'randmind', name:'RandMind', status:EcosystemStatus.LIVE, phase:'KNOWLEDGE', evidence:['src/randai/memory/randmind.js','src/randai/memory/engine.js','src/randai/memory/store.js','src/randai/memory/production-gate.js','src/randai/control/RandMindConsole.jsx','supabase/migrations/20260903223000_randmind_live_81_86.sql','test/randai-block23-randmind-81-86.test.js'], description:'Memoria canonica governata: episodi e fatti operativi con provenienza, temporalità, confidence, conflitti, supersession, retention e forgetting auditabile hotel-scoped.' },
  { id:'randbrain', name:'RandBrain', status:EcosystemStatus.LIVE, phase:'AI', evidence:['src/randai/randbrain/engine.js','src/randai/randbrain/router.js','src/randai/randbrain/reasoning-graph.js','src/randai/randbrain/learning.js','src/randai/randbrain/production-gate.js','src/randai/control/RandBrainConsole.jsx','src/randai/supervisor','src/randai/agents','src/randai/autonomy','src/randai/learning','test/randai-block24-randbrain-87-92.test.js'], description:'Orchestratore superiore governato: routing dinamico minimale, reasoning graph evidence-backed, livelli espliciti di autonomia, Action Gateway boundary, learning verificato e production gate.' },
  { id:'reporadar', name:'Repo Radar', status:EcosystemStatus.LIVE, phase:'DISCOVERY', evidence:['src/randai/discovery/engine.js','src/randai/discovery/repo-radar.js','src/randai/control/RepoRadarConsole.jsx','.github/workflows/repo-radar.yml'], description:'Scouting settimanale, discovery di nuove candidate, valutazione profonda e adozione governata senza auto-install.' },
  { id:'randaudio', name:'RandAudio', status:EcosystemStatus.PLANNED, phase:'EXPERIENCE', evidence:[], description:'Pipeline STT/TTS/audio non ancora costituita.' },
  { id:'randui', name:'RandUI', status:EcosystemStatus.LIVE, phase:'EXPERIENCE', evidence:['src/randapp/ui.jsx','src/randapp/ui-coherence.css','src/randapp/hotel-identity.js','src/randapp/theme.js','src/randapp/Shell.jsx','test/randai-block25-randui-93-97.test.js','test/e2e.mjs','test/device-acceptance.mjs'], description:'Design system canonico versionato: identità multi-hotel, System/Light/Dark, chrome unica, layout adattivo e visual quality gate cross-platform.' },
  { id:'viking', name:'Viking', status:EcosystemStatus.PLANNED, phase:'EVALUATION', evidence:[], description:'Solo candidato: nessuna integrazione finché non supera evaluation gate.' },
  { id:'warehouse', name:'Rand Warehouse', status:EcosystemStatus.LIVE, phase:'BUSINESS', evidence:['src/inventory-data.js','src/inventory-intervention-data.js','src/randai/context/warehouse-evidence.js','src/randapp/operations/InterventionsView.jsx','supabase/migrations/20260901112200_inventory_block3_intervention_parts.sql'], description:'Bounded domain Magazzino con ledger, stock/seriali e integrazione transazionale con Interventi e contesto RandAI read-only.' },
])

export function getRandEcosystemManifest(){
  return MODULES.map((item)=>({...item,evidence:[...item.evidence]}))
}

export function summarizeRandEcosystem(modules=getRandEcosystemManifest()){
  const counts=Object.fromEntries(Object.values(EcosystemStatus).map((status)=>[status,0]))
  for(const item of modules) counts[item.status]=(counts[item.status]||0)+1
  return { total:modules.length, counts, ready:counts.LIVE, unfinished:modules.length-counts.LIVE-counts.ZOMBIE }
}

export function assertRandEcosystemManifest(modules=getRandEcosystemManifest()){
  const ids=new Set()
  for(const item of modules){
    if(!item.id||!item.name||!Object.values(EcosystemStatus).includes(item.status)) throw new TypeError('Invalid Rand ecosystem module')
    if(ids.has(item.id)) throw new TypeError(`Duplicate Rand ecosystem module: ${item.id}`)
    ids.add(item.id)
    if(item.status===EcosystemStatus.LIVE&&!item.evidence.length) throw new TypeError(`LIVE module without evidence: ${item.id}`)
    if(item.status===EcosystemStatus.ZOMBIE&&item.evidence.length) throw new TypeError(`ZOMBIE module still declares canonical evidence: ${item.id}`)
  }
  return true
}
