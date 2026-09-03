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
  { id:'randcore', name:'RandCore', status:EcosystemStatus.LIVE, phase:'CORE', evidence:['src/randai/core/orchestrator.js','src/randai/action-gateway.js','src/reliability/release-gate.js'], description:'Contratti e governance canonici; non sostituisce RLS/RPC.' },
  { id:'randcontrol', name:'RandControl', status:EcosystemStatus.LIVE, phase:'CONTROL', evidence:['src/randai/control/RandAIControlCenter.jsx','src/randai/control-center/engine.js'], description:'Control Center amministrativo e proiezione governance.' },
  { id:'randguide', name:'RandGuide', status:EcosystemStatus.PARTIAL, phase:'KNOWLEDGE', evidence:['src/randai/console/RandAIConsole.jsx','src/randai/guidance'], description:'Conoscenze e procedure guidate esistono; prodotto dedicato da consolidare.' },
  { id:'randmind', name:'RandMind', status:EcosystemStatus.PARTIAL, phase:'KNOWLEDGE', evidence:['src/randai/memory','src/randai/context','src/randai/project-intelligence.js'], description:'Memoria, contesto e intelligence esistono come capability; facade dedicata da consolidare.' },
  { id:'randbrain', name:'RandBrain', status:EcosystemStatus.PARTIAL, phase:'AI', evidence:['src/randai/supervisor','src/randai/agents','src/randai/autonomy'], description:'Supervisor, multi-agent e autonomia esistono; orchestratore superiore da consolidare.' },
  { id:'reporadar', name:'Repo Radar', status:EcosystemStatus.LIVE, phase:'DISCOVERY', evidence:['src/randai/discovery/engine.js','src/randai/discovery/repo-radar.js','src/randai/control/RepoRadarConsole.jsx','.github/workflows/repo-radar.yml'], description:'Scouting settimanale, valutazione profonda e adozione governata senza auto-install.' },
  { id:'randaudio', name:'RandAudio', status:EcosystemStatus.PLANNED, phase:'EXPERIENCE', evidence:[], description:'Pipeline STT/TTS/audio non ancora costituita.' },
  { id:'randui', name:'RandUI', status:EcosystemStatus.PARTIAL, phase:'EXPERIENCE', evidence:['src/randapp/ui.jsx','src/randapp/ui-coherence.css'], description:'Primitive UI condivise presenti; design system dedicato da consolidare.' },
  { id:'viking', name:'Viking', status:EcosystemStatus.PLANNED, phase:'EVALUATION', evidence:[], description:'Solo candidato: nessuna integrazione finché non supera evaluation gate.' },
  { id:'warehouse', name:'Rand Warehouse', status:EcosystemStatus.PLANNED, phase:'BUSINESS', evidence:[], description:'Modulo magazzino previsto come dominio autonomo collegato.' },
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
