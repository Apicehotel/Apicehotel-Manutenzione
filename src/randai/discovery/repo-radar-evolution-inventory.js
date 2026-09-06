import { getRandEcosystemManifest } from '../core/ecosystem.js'
import { listRandUiPages } from '../../randapp/randui/page-catalog.js'

export const EVOLUTION_COVERAGE_CONTRACT='RAND_FULL_EVOLUTION_V1'

const APP_DOMAIN_TERMS=Object.freeze({
  operations:'hotel operations workflow task management',
  maintenance:'hotel maintenance work orders issue tracking',
  communications:'team messaging alerts operational communication',
  housekeeping:'hotel housekeeping room floor operations',
  supplies:'hotel supplies replenishment linen amenities inventory',
  warehouse:'inventory warehouse stock movements audit',
  planning:'resource planning scheduling calendar timeline booking',
  sensors:'iot sensors monitoring telemetry alerts history',
  account:'user account profile preferences authentication',
  guides:'knowledge base procedures search documentation',
  administration:'admin rbac permissions users diagnostics',
  desktop:'desktop pwa windows notifications offline',
  intelligence:'ai assistant agent control observability governance',
})

const PAGE_TYPE_TERMS=Object.freeze({
  dashboard:'dashboard kpi next actions', operational:'mobile operational workflow', 'list-detail':'list detail workflow',
  'master-detail':'master detail realtime', management:'management console audit', planning:'scheduler planning calendar',
  list:'list filters status', monitor:'monitoring history alerts', form:'form validation settings',
  'search-archive':'search archive knowledge', 'system-state':'system state install update', settings:'settings administration',
})

const ECOSYSTEM_QUERY=Object.freeze({
  randapp:'react pwa hotel operations offline mobile desktop architecture',
  randai:'typescript ai assistant agent runtime tool use production governance',
  randcore:'application governance health checks release gates audit reliability',
  randcontrol:'admin control center observability health dashboard governance',
  randguide:'knowledge base procedures ingestion provenance knowledge graph guided workflow',
  randmind:'ai memory long term memory provenance temporal conflict retention',
  randbrain:'ai agent orchestration reasoning graph model routing autonomy learning',
  randaudio:'speech to text text to speech browser audio voice assistant webkit',
  randui:'react design system adaptive responsive accessibility mobile desktop',
  viking:'context retrieval hierarchical loading retrieval trace agent context',
  warehouse:'inventory ledger stock serial warehouse work order integration',
})

export const AI_EVOLUTION_PROFILES=Object.freeze([
  {id:'ai-agent-runtime',sector:'AI_AGENT_RUNTIME',priority:1,query:'typescript AI agent runtime orchestration tools production'},
  {id:'ai-model-routing',sector:'AI_MODEL_ROUTING',priority:.98,query:'LLM model router fallback cost latency quality routing'},
  {id:'ai-tool-use-mcp',sector:'AI_TOOL_USE_MCP',priority:.98,query:'Model Context Protocol MCP tool use permissions security TypeScript'},
  {id:'ai-memory',sector:'AI_MEMORY',priority:.98,query:'LLM agent memory long term temporal provenance conflict retention'},
  {id:'ai-rag-retrieval',sector:'AI_RAG_RETRIEVAL',priority:.97,query:'RAG retrieval hybrid search reranking citations provenance'},
  {id:'ai-evals',sector:'AI_EVALS',priority:1,query:'LLM agent evals regression benchmark red team production'},
  {id:'ai-observability',sector:'AI_OBSERVABILITY',priority:.98,query:'LLM observability tracing agent telemetry cost latency quality'},
  {id:'ai-guardrails',sector:'AI_GUARDRAILS',priority:1,query:'LLM guardrails prompt injection tool security policy enforcement'},
  {id:'ai-multimodal',sector:'AI_MULTIMODAL',priority:.92,query:'multimodal AI vision document image understanding agent TypeScript'},
  {id:'ai-voice',sector:'AI_VOICE',priority:.92,query:'voice AI speech recognition text to speech realtime web browser'},
  {id:'ai-coding-agent',sector:'AI_CODING_AGENT',priority:.9,query:'coding agent repository analysis patch test code review'},
  {id:'ai-learning',sector:'AI_LEARNING',priority:.95,query:'agent learning feedback verified memory policy safe self improvement'},
  {id:'ai-cost-optimization',sector:'AI_COST_OPTIMIZATION',priority:.94,query:'LLM cost optimization caching routing batching token usage'},
  {id:'ai-context-engineering',sector:'AI_CONTEXT_ENGINEERING',priority:.96,query:'LLM context engineering compression selection retrieval agent'},
])

function slug(value){ return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }
function unique(items,key=(item)=>item.id){ const seen=new Set(); return items.filter((item)=>{ const id=key(item); if(seen.has(id)) return false; seen.add(id); return true }) }

export function buildRepoRadarEvolutionInventory(){
  const pages=listRandUiPages().map((page)=>Object.freeze({
    kind:'APP_PAGE', id:page.id, domain:page.domain, pageType:page.pageType,
    capabilities:Object.freeze([...(page.capabilities||[])]), permissions:Object.freeze([...(page.permissions||[])]),
  }))
  const ecosystem=getRandEcosystemManifest().filter((item)=>item.id!=='reporadar').map((item)=>Object.freeze({
    kind:'ECOSYSTEM_MODULE', id:item.id, name:item.name, phase:item.phase, status:item.status, description:item.description,
  }))
  const ai=AI_EVOLUTION_PROFILES.map((item)=>Object.freeze({kind:'AI_EVOLUTION',id:item.id,sector:item.sector}))
  return Object.freeze({contract:EVOLUTION_COVERAGE_CONTRACT,pages:Object.freeze(pages),ecosystem:Object.freeze(ecosystem),ai:Object.freeze(ai)})
}

export function buildRepoRadarSearchProfiles(){
  const inventory=buildRepoRadarEvolutionInventory()
  const pageProfiles=inventory.pages.map((page)=>({
    id:`app-${slug(page.id)}`, category:'RANDAPP', sector:`PAGE_${String(page.id).toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`,
    priority:page.domain==='maintenance'||page.domain==='operations'||page.domain==='planning'?.98:.9,
    query:`${APP_DOMAIN_TERMS[page.domain]||page.domain} ${PAGE_TYPE_TERMS[page.pageType]||page.pageType} ${(page.capabilities||[]).join(' ')} React TypeScript responsive accessible`,
    inventoryRef:`page:${page.id}`,
  }))
  const ecosystemProfiles=inventory.ecosystem.map((module)=>({
    id:`ecosystem-${module.id}`, category:'RAND_ECOSYSTEM', sector:`MODULE_${module.id.toUpperCase()}`,
    priority:module.status==='LIVE'?.92:.96, query:ECOSYSTEM_QUERY[module.id]||`${module.name} ${module.description} software architecture`,
    inventoryRef:`module:${module.id}`,
  }))
  const aiProfiles=AI_EVOLUTION_PROFILES.map((profile)=>({...profile,category:'RANDAI',inventoryRef:`ai:${profile.id}`}))
  return Object.freeze(unique([...pageProfiles,...ecosystemProfiles,...aiProfiles]).map((profile)=>Object.freeze({...profile,github:`${profile.query} archived:false`})))
}

export function summarizeRepoRadarEvolutionCoverage(profiles=buildRepoRadarSearchProfiles()){
  const inventory=buildRepoRadarEvolutionInventory()
  const refs=new Set(profiles.map((item)=>item.inventoryRef))
  const missingPages=inventory.pages.filter((item)=>!refs.has(`page:${item.id}`)).map((item)=>item.id)
  const missingModules=inventory.ecosystem.filter((item)=>!refs.has(`module:${item.id}`)).map((item)=>item.id)
  const missingAi=inventory.ai.filter((item)=>!refs.has(`ai:${item.id}`)).map((item)=>item.id)
  return Object.freeze({contract:inventory.contract,pageCount:inventory.pages.length,moduleCount:inventory.ecosystem.length,aiEvolutionCount:inventory.ai.length,profileCount:profiles.length,missingPages:Object.freeze(missingPages),missingModules:Object.freeze(missingModules),missingAi:Object.freeze(missingAi),complete:missingPages.length===0&&missingModules.length===0&&missingAi.length===0})
}
