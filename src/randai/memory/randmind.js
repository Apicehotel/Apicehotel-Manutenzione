import { MemoryEngine } from './engine.js'
import { MemoryScope, MemoryTrust, MemoryType, validateMemory } from './contracts.js'

export const MemoryLifecycle = Object.freeze({ ACTIVE:'active', SUPERSEDED:'superseded', FORGOTTEN:'forgotten' })
export const RetentionClass = Object.freeze({ TRANSIENT:'transient', OPERATIONAL:'operational', LONG_TERM:'long_term', LEGAL_HOLD:'legal_hold' })

const clamp01=(v,d=0.5)=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):d))
const dateMs=(v)=>v?Date.parse(v):NaN
const isFresh=(memory,now=Date.now())=>!memory.validUntil||dateMs(memory.validUntil)>now
const isUsable=(memory,now=Date.now())=>memory.lifecycleStatus!==MemoryLifecycle.FORGOTTEN&&memory.lifecycleStatus!==MemoryLifecycle.SUPERSEDED&&isFresh(memory,now)&&memory.trust!==MemoryTrust.OUTDATED

export function normalizeRandMindMemory(input={}){
  const memory={
    ...input,
    type:input.type||MemoryType.EPISODIC,
    scope:input.scope||MemoryScope.HOTEL,
    trust:input.trust||MemoryTrust.DRAFT,
    confidence:clamp01(input.confidence), importance:clamp01(input.importance),
    lifecycleStatus:input.lifecycleStatus||MemoryLifecycle.ACTIVE,
    retentionClass:input.retentionClass||RetentionClass.OPERATIONAL,
    validFrom:input.validFrom||input.createdAt||new Date().toISOString(),
    validUntil:input.validUntil||input.expiresAt||null,
    lastVerifiedAt:input.lastVerifiedAt||null,
    supersedesId:input.supersedesId||null,
    conflictGroup:input.conflictGroup||null,
    contentHash:input.contentHash||null,
  }
  validateMemory(memory)
  if(!Object.values(MemoryLifecycle).includes(memory.lifecycleStatus)) throw new TypeError('Invalid memory lifecycle')
  if(!Object.values(RetentionClass).includes(memory.retentionClass)) throw new TypeError('Invalid retention class')
  return memory
}

export function memoryQuality(memory,now=Date.now()){
  const m=normalizeRandMindMemory(memory)
  const source=m.source?.kind&&m.source?.id?1:0
  const verified=[MemoryTrust.VERIFIED,MemoryTrust.APPROVED].includes(m.trust)?1:0
  const freshness=isFresh(m,now)?1:0
  const lifecycle=isUsable(m,now)?1:0
  const score=Math.round((m.confidence*0.35+source*0.2+verified*0.25+freshness*0.1+lifecycle*0.1)*100)
  return {score,usable:Boolean(lifecycle&&source&&m.confidence>=0.6),fresh:Boolean(freshness),verified:Boolean(verified)}
}

export function detectMemoryConflicts(items=[]){
  const groups=new Map()
  for(const m of items){if(!m.conflictGroup) continue; const list=groups.get(m.conflictGroup)||[]; list.push(m); groups.set(m.conflictGroup,list)}
  return [...groups.entries()].filter(([,list])=>list.filter((m)=>isUsable(m)).length>1).map(([group,list])=>({group,ids:list.filter((m)=>isUsable(m)).map((m)=>m.id)}))
}

export class RandMind {
  constructor({store}){this.engine=new MemoryEngine({store});this.store=store}
  async remember(input){
    const normalized=normalizeRandMindMemory(input)
    const duplicate=await this.engine.deduplicate(normalized,0.9).catch(()=>null)
    if(duplicate&&duplicate.id!==normalized.id) return {memory:duplicate,deduplicated:true}
    const memory=await this.engine.remember(normalized)
    return {memory,deduplicated:false}
  }
  async recall(query,filters={}){
    const rows=await this.engine.recall(query,filters)
    return rows.filter((m)=>isUsable(m)).map((m)=>({...m,quality:memoryQuality(m)})).filter((m)=>m.quality.usable).sort((a,b)=>(b.quality.score-a.quality.score)||(b.score-a.score))
  }
  async timeline(filters={}){
    const rows=await this.store.list(filters)
    return rows.slice().sort((a,b)=>dateMs(a.validFrom||a.createdAt)-dateMs(b.validFrom||b.createdAt))
  }
  async conflicts(filters={}){return detectMemoryConflicts(await this.store.list(filters))}
}
