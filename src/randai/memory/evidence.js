import { MemoryScope, MemoryTrust, MemoryType } from './contracts.js'
import { MemoryLifecycle, RetentionClass, memoryQuality } from './randmind.js'

const clean=(v)=>String(v??'').trim()
const dateMs=(v)=>v?Date.parse(v):NaN

export const VERIFIED_OUTCOME_CODE='OUTCOME_VERIFIED'

export function memoryFromVerifiedAudit(audit={},candidate={}){
  if(audit.kind!=='ACTION_OUTCOME') throw new TypeError('Only ACTION_OUTCOME audit can feed RandMind')
  if(clean(audit.decision).toUpperCase()!=='SUCCEEDED') throw new TypeError('Only successful outcomes can feed RandMind')
  if(!(audit.reasonCodes||[]).includes(VERIFIED_OUTCOME_CODE)) throw new TypeError('Verified outcome evidence is required')
  const content=clean(candidate.content); if(!content) throw new TypeError('Verified memory content is required')
  const scope=audit.scope==='HOTEL'?MemoryScope.HOTEL:(candidate.scope||MemoryScope.GLOBAL)
  if(scope===MemoryScope.HOTEL && (!audit.hotelId || (candidate.hotelId && candidate.hotelId!==audit.hotelId))) throw new TypeError('Audit/memory hotel scope mismatch')
  return {
    ...candidate,
    type:candidate.type||MemoryType.EPISODIC,
    scope,
    hotelId:scope===MemoryScope.HOTEL?audit.hotelId:(candidate.hotelId||null),
    trust:MemoryTrust.VERIFIED,
    content,
    source:{kind:'governance_audit',id:audit.auditId,uri:candidate.source?.uri||null},
    confidence:Math.max(0.6,Math.min(1,Number(candidate.confidence??0.85))),
    lastVerifiedAt:new Date(audit.occurredAt).toISOString(),
    metadata:{...(candidate.metadata||{}),governanceCorrelationId:audit.correlationId||null,governanceIntentId:audit.intentId||null,governanceDecision:audit.decision,governanceReasonCodes:[...(audit.reasonCodes||[])]},
  }
}

export function usableAt(memory,asOf){
  const at=typeof asOf==='number'?asOf:dateMs(asOf); if(!Number.isFinite(at)) throw new TypeError('asOf must be a valid timestamp')
  const validFrom=dateMs(memory.validFrom||memory.createdAt); if(Number.isFinite(validFrom)&&validFrom>at) return false
  const validUntil=dateMs(memory.validUntil||memory.expiresAt); if(Number.isFinite(validUntil)&&validUntil<=at) return false
  const forgottenAt=dateMs(memory.forgottenAt); if(memory.lifecycleStatus===MemoryLifecycle.FORGOTTEN && (!Number.isFinite(forgottenAt)||forgottenAt<=at)) return false
  const supersededAt=dateMs(memory.supersededAt); if(memory.lifecycleStatus===MemoryLifecycle.SUPERSEDED && (!Number.isFinite(supersededAt)||supersededAt<=at)) return false
  return memory.trust!==MemoryTrust.OUTDATED || (Number.isFinite(forgottenAt)&&at<forgottenAt) || (Number.isFinite(supersededAt)&&at<supersededAt)
}

export function suggestConflictWinner(items=[],now=Date.now()){
  const ranked=items.map((memory)=>({memory,quality:memoryQuality(memory,now)})).sort((a,b)=>b.quality.score-a.quality.score || String(a.memory.id).localeCompare(String(b.memory.id)))
  if(!ranked.length) return {winnerId:null,ambiguous:true,ranked:[]}
  const ambiguous=ranked.length>1 && ranked[0].quality.score===ranked[1].quality.score
  return {winnerId:ambiguous?null:ranked[0].memory.id,ambiguous,ranked:ranked.map(({memory,quality})=>({id:memory.id,score:quality.score,trust:memory.trust,lastVerifiedAt:memory.lastVerifiedAt||null}))}
}

export function planRetention(items=[],policy={},now=Date.now()){
  const candidates=[]
  for(const memory of items){
    if(memory.lifecycleStatus!==MemoryLifecycle.ACTIVE || memory.retentionClass===RetentionClass.LEGAL_HOLD) continue
    const days=Number(policy[memory.retentionClass]); if(!Number.isFinite(days)||days<0) continue
    const anchor=dateMs(memory.lastVerifiedAt||memory.updatedAt||memory.createdAt); if(!Number.isFinite(anchor)) continue
    const dueAt=anchor+days*86400000
    if(dueAt<=now) candidates.push({id:memory.id,retentionClass:memory.retentionClass,dueAt:new Date(dueAt).toISOString(),reason:`RETENTION_${memory.retentionClass.toUpperCase()}_EXPIRED`})
  }
  return {generatedAt:new Date(now).toISOString(),candidates}
}
