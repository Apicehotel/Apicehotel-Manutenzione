import { MemoryLifecycle, RetentionClass, memoryQuality } from './randmind.js'

export function evaluateRandMindProductionGate({ memories=[], expectedHotelIds=[] }={}){
  const blockers=[]
  const hotelIds=new Set(memories.filter((m)=>m.scope==='hotel'&&m.hotelId).map((m)=>m.hotelId))
  for(const id of expectedHotelIds) if(!hotelIds.has(id)) blockers.push({code:'HOTEL_SCOPE_UNPROVEN',hotelId:id})
  for(const memory of memories){
    if(memory.scope==='hotel'&&!memory.hotelId) blockers.push({code:'HOTEL_ID_MISSING',id:memory.id})
    if(memory.lifecycleStatus===MemoryLifecycle.ACTIVE&&memory.retentionClass===RetentionClass.TRANSIENT&&!memory.validUntil&&!memory.expiresAt) blockers.push({code:'TRANSIENT_WITHOUT_EXPIRY',id:memory.id})
    const quality=memoryQuality(memory)
    if(memory.lifecycleStatus===MemoryLifecycle.ACTIVE&&['verified','approved'].includes(memory.trust)&&!quality.usable) blockers.push({code:'TRUST_WITHOUT_USABLE_EVIDENCE',id:memory.id})
    if(memory.lifecycleStatus===MemoryLifecycle.FORGOTTEN&&!memory.forgottenAt) blockers.push({code:'FORGET_WITHOUT_AUDIT',id:memory.id})
    if(memory.supersedesId===memory.id) blockers.push({code:'SELF_SUPERSESSION',id:memory.id})
  }
  return {ready:blockers.length===0,status:blockers.length?'BLOCKED':'LIVE_READY',blockers,total:memories.length,hotelCoverage:hotelIds.size}
}
