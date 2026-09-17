export const ResearchLevel = Object.freeze({ L0:'L0', L1:'L1', L2:'L2', L3:'L3', L4:'L4' })
export const ResearchStatus = Object.freeze({ PLANNED:'PLANNED', RUNNING:'RUNNING', NEEDS_REVIEW:'NEEDS_REVIEW', READY:'READY', BLOCKED:'BLOCKED' })
export const SourceTier = Object.freeze({ PRIMARY:'PRIMARY', AUTHORITATIVE:'AUTHORITATIVE', SECONDARY:'SECONDARY', COMMUNITY:'COMMUNITY', UNKNOWN:'UNKNOWN' })
export const ContradictionSeverity = Object.freeze({ INFO:'INFO', WARN:'WARN', HIGH:'HIGH', CRITICAL:'CRITICAL' })

const LEVEL_BUDGET = Object.freeze({ L0:{queries:1,sources:3,critic:false}, L1:{queries:3,sources:8,critic:false}, L2:{queries:6,sources:20,critic:true}, L3:{queries:12,sources:50,critic:true}, L4:{queries:24,sources:120,critic:true} })
const clean=(v)=>String(v??'').trim()
const clamp01=(v,d=.5)=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):d))
const clone=(v)=>structuredClone(v)
const freeze=(v)=>Object.freeze(clone(v))
const id=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2,9)}`

export function researchBudget(level=ResearchLevel.L1){ if(!LEVEL_BUDGET[level]) throw new TypeError('Unknown research level'); return freeze(LEVEL_BUDGET[level]) }

export function canonicalizeResearchRequest(input={}){
 const query=clean(input.query); const hotelId=clean(input.hotelId); const level=clean(input.level||ResearchLevel.L1).toUpperCase()
 if(!query) throw new TypeError('Research query is required')
 if(!hotelId) throw new TypeError('Research hotel scope is required')
 if(!LEVEL_BUDGET[level]) throw new TypeError('Unknown research level')
 const requirements=[...new Set((input.requirements||[]).map(clean).filter(Boolean))]
 return freeze({query,hotelId,level,requirements,recencyDays:Math.max(0,Number(input.recencyDays)||0),language:clean(input.language||'it'),budget:LEVEL_BUDGET[level]})
}

export function createResearchPlan(request, {sessionId=`research_${id()}`}={}){
 const r=canonicalizeResearchRequest(request)
 const subqueries=[r.query,...r.requirements.map((x)=>`${r.query} :: ${x}`)].slice(0,r.budget.queries)
 return freeze({sessionId,canonicalQuery:r.query,hotelId:r.hotelId,level:r.level,requirements:r.requirements,budget:r.budget,subqueries,status:ResearchStatus.PLANNED,createdAt:Date.now()})
}

const TYPE_WEIGHT=Object.freeze({[SourceTier.PRIMARY]:1,[SourceTier.AUTHORITATIVE]:.95,[SourceTier.SECONDARY]:.7,[SourceTier.COMMUNITY]:.5,[SourceTier.UNKNOWN]:.3})
export function scoreResearchSource(source={}){
 const tier=clean(source.tier||SourceTier.UNKNOWN).toUpperCase(); if(!TYPE_WEIGHT[tier]) throw new TypeError('Unknown source tier')
 const direct=clamp01(source.directness,.5), recency=clamp01(source.recency,.5), corroboration=clamp01(source.corroboration,.5), retrieval=clamp01(source.retrievalConfidence,.7)
 return Math.round((TYPE_WEIGHT[tier]*.35+direct*.25+recency*.15+corroboration*.15+retrieval*.10)*100)
}

export function normalizeResearchSource(input={}, {hotelId}={}){
 const sourceHotel=clean(input.hotelId||hotelId); if(!sourceHotel||sourceHotel!==clean(hotelId)) throw new TypeError('Research source hotel scope mismatch')
 const sourceId=clean(input.source?.id||input.id), kind=clean(input.source?.kind||'web'), uri=clean(input.source?.uri||input.url)
 const title=clean(input.title), excerpt=clean(input.excerpt||input.content)
 if(!sourceId||!kind||!uri||!title||!excerpt) throw new TypeError('Research source provenance, title and content are required')
 const claims=(input.claims||[]).map((c)=>({key:clean(c.key),value:clean(c.value),confidence:clamp01(c.confidence,.7)})).filter((c)=>c.key&&c.value)
 const normalized={sourceId,hotelId:sourceHotel,source:{id:sourceId,kind,uri},title,excerpt,tier:clean(input.tier||SourceTier.UNKNOWN).toUpperCase(),publishedAt:input.publishedAt||null,fetchedAt:input.fetchedAt||new Date().toISOString(),claims,coverage:[...new Set((input.coverage||[]).map(clean).filter(Boolean))],directness:clamp01(input.directness,.5),recency:clamp01(input.recency,.5),corroboration:clamp01(input.corroboration,.5),retrievalConfidence:clamp01(input.retrievalConfidence,.7),promptInjectionRisk:Boolean(input.promptInjectionRisk),retractionRisk:Boolean(input.retractionRisk)}
 normalized.qualityScore=scoreResearchSource(normalized)
 return freeze(normalized)
}

export function detectResearchContradictions(sources=[]){
 const byKey=new Map(); for(const s of sources) for(const claim of s.claims||[]){ const arr=byKey.get(claim.key)||[];arr.push({sourceId:s.sourceId,value:claim.value,confidence:claim.confidence,qualityScore:s.qualityScore});byKey.set(claim.key,arr) }
 const out=[]
 for(const [key,claims] of byKey){ const values=new Set(claims.map((x)=>x.value.toLowerCase())); if(values.size<2) continue; const high=claims.filter((x)=>x.qualityScore>=70&&x.confidence>=.7).length; out.push(freeze({id:`contradiction_${key}_${id()}`,key,severity:high>=2?ContradictionSeverity.HIGH:ContradictionSeverity.WARN,claims,resolved:false,resolution:null})) }
 return out
}

export function researchGaps(plan,sources=[]){
 const covered=new Set(sources.flatMap((s)=>s.coverage||[])); return plan.requirements.filter((req)=>!covered.has(req)).map((requirement)=>freeze({requirement,code:'REQUIREMENT_UNCOVERED'}))
}

export function evaluateResearchShipGate({plan,sources=[],contradictions=[],gaps=[],report}={}){
 const blockers=[]; const budget=plan?.budget||{}
 if(!plan?.canonicalQuery) blockers.push({code:'CANONICAL_QUERY_MISSING'})
 if(!sources.length) blockers.push({code:'NO_SOURCES'})
 if(sources.some((s)=>s.hotelId!==plan.hotelId)) blockers.push({code:'CROSS_HOTEL_SOURCE'})
 if(sources.some((s)=>s.promptInjectionRisk)) blockers.push({code:'PROMPT_INJECTION_SOURCE'})
 if(sources.some((s)=>s.retractionRisk)) blockers.push({code:'RETRACTION_RISK'})
 if(gaps.length && ['L2','L3','L4'].includes(plan.level)) blockers.push({code:'RESEARCH_GAPS',count:gaps.length})
 if(contradictions.some((c)=>!c.resolved&&['HIGH','CRITICAL'].includes(c.severity))) blockers.push({code:'UNRESOLVED_HIGH_CONTRADICTION'})
 if(plan.level==='L4' && sources.filter((s)=>s.qualityScore>=70).length<2) blockers.push({code:'AUDIT_NEEDS_TWO_HIGH_QUALITY_SOURCES'})
 if(!clean(report?.summary)) blockers.push({code:'REPORT_MISSING'})
 const cited=new Set(report?.sourceIds||[]); if(report&&sources.some((s)=>!cited.has(s.sourceId))&&plan.level==='L4') blockers.push({code:'AUDIT_SOURCE_NOT_CITED'})
 return freeze({ready:blockers.length===0,status:blockers.length?ResearchStatus.BLOCKED:ResearchStatus.READY,blockers,sourceCount:sources.length,sourceBudget:budget.sources||0})
}

export class InMemoryResearchStore{
 constructor(){this.sessions=new Map()}
 async save(session){this.sessions.set(session.sessionId,clone(session));return clone(session)}
 async get(sessionId){const x=this.sessions.get(sessionId);return x?clone(x):null}
}

export class RandResearch{
 constructor({store=new InMemoryResearchStore()}={}){this.store=store}
 async start(request){const plan=createResearchPlan(request);const session={...plan,sources:[],contradictions:[],gaps:plan.requirements.map((requirement)=>({requirement,code:'REQUIREMENT_UNCOVERED'})),report:null,status:ResearchStatus.RUNNING,updatedAt:Date.now()};await this.store.save(session);return freeze(session)}
 async addSources(sessionId,items=[]){const session=await this.#required(sessionId);const map=new Map(session.sources.map((s)=>[s.sourceId,s]));for(const item of items){const source=normalizeResearchSource(item,{hotelId:session.hotelId});const prev=map.get(source.sourceId);if(!prev||source.qualityScore>prev.qualityScore)map.set(source.sourceId,source)}session.sources=[...map.values()].sort((a,b)=>b.qualityScore-a.qualityScore).slice(0,session.budget.sources);session.contradictions=detectResearchContradictions(session.sources);session.gaps=researchGaps(session,session.sources);session.updatedAt=Date.now();await this.store.save(session);return freeze(session)}
 async resolveContradiction(sessionId,{contradictionId,resolution,evidenceSourceIds=[]}={}){const session=await this.#required(sessionId);const c=session.contradictions.find((x)=>x.id===contradictionId);if(!c)throw new Error('Research contradiction not found');if(!clean(resolution)||!evidenceSourceIds.length)throw new TypeError('Contradiction resolution requires explanation and evidence');const valid=new Set(session.sources.map((s)=>s.sourceId));if(evidenceSourceIds.some((x)=>!valid.has(x)))throw new TypeError('Unknown contradiction evidence source');c.resolved=true;c.resolution={text:clean(resolution),evidenceSourceIds:[...new Set(evidenceSourceIds)]};session.updatedAt=Date.now();await this.store.save(session);return freeze(session)}
 async finalize(sessionId,report){const session=await this.#required(sessionId);session.report={summary:clean(report?.summary),sourceIds:[...new Set(report?.sourceIds||[])],findings:clone(report?.findings||[]),limitations:clone(report?.limitations||[])};const gate=evaluateResearchShipGate({plan:session,sources:session.sources,contradictions:session.contradictions,gaps:session.gaps,report:session.report});session.status=gate.status;session.shipGate=gate;session.updatedAt=Date.now();await this.store.save(session);return freeze(session)}
 async #required(id){const s=await this.store.get(id);if(!s)throw new Error('Research session not found');return s}
}
