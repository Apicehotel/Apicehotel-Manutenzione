import { ProactiveDecision, SEVERITY_ORDER, SignalSeverity, SignalStatus, normalizeSignalScope, validateSignal } from './contracts.js'
import { ProactiveSignalStore } from './store.js'
const clone=v=>structuredClone(v)
const nowIso=()=>new Date().toISOString()
const makeId=()=>`SIG-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2,9)}`}`

export class ProactiveEngine {
  constructor({store=new ProactiveSignalStore(),supervisor=null,eventSink=null,onTelemetryError=null,cooldownMs=15*60*1000,actThreshold=SignalSeverity.HIGH}={}){
    if(eventSink!=null&&typeof eventSink!=='function') throw new TypeError('eventSink must be a function')
    if(onTelemetryError!=null&&typeof onTelemetryError!=='function') throw new TypeError('onTelemetryError must be a function')
    if(!Number.isFinite(Number(cooldownMs))||Number(cooldownMs)<0) throw new TypeError('cooldownMs must be a finite number >= 0')
    if(!SEVERITY_ORDER.includes(actThreshold)) throw new TypeError(`Invalid actThreshold: ${actThreshold}`)
    this.store=store; this.supervisor=supervisor; this.eventSink=eventSink; this.onTelemetryError=onTelemetryError; this.cooldownMs=Number(cooldownMs); this.actThreshold=actThreshold
  }
  async ingest({projectId='randai',hotelId=null,global=false,type,fingerprint,severity=SignalSeverity.MEDIUM,title=null,data={},source=null}={}){
    if(!String(projectId||'').trim()||!type||!fingerprint) throw new TypeError('projectId, type and fingerprint are required')
    const scope=normalizeSignalScope({hotelId,global}); if(!scope.hotelId&&!scope.global) throw new TypeError('Proactive signal requires hotelId or explicit global scope')
    const existing=await this.store.findOpenByFingerprint(projectId,fingerprint,scope)
    if(existing){
      const updatedMs=new Date(existing.updatedAt).getTime(); const within=Number.isFinite(updatedMs)&&Date.now()-updatedMs<this.cooldownMs
      const item={...existing,count:(existing.count||1)+1,lastData:clone(data),updatedAt:nowIso(),lastSeenAt:nowIso(),sources:[...new Set([...(existing.sources||[]),source].filter(Boolean))]}
      if(within) item.suppressedDuplicates=(item.suppressedDuplicates||0)+1
      await this.store.save(item); await this.#emit('PROACTIVE_SIGNAL_DEDUPED',{id:item.id,projectId,hotelId:scope.hotelId,global:scope.global,fingerprint,count:item.count,withinCooldown:within}); return clone(item)
    }
    const item={id:makeId(),projectId,hotelId:scope.hotelId,global:scope.global,type,fingerprint,severity,status:SignalStatus.OPEN,title:title||type,count:1,data:clone(data),sources:source?[source]:[],createdAt:nowIso(),updatedAt:nowIso(),lastSeenAt:nowIso(),resolvedAt:null,decision:null,supervisorRunId:null}
    validateSignal(item); await this.store.save(item); await this.#emit('PROACTIVE_SIGNAL_OPENED',{id:item.id,projectId,hotelId:item.hotelId,global:item.global,type,severity}); return clone(item)
  }
  decide(signal,{allowAct=true}={}){
    validateSignal(signal); const level=SEVERITY_ORDER.indexOf(signal.severity); const threshold=SEVERITY_ORDER.indexOf(this.actThreshold)
    if(signal.severity===SignalSeverity.CRITICAL) return ProactiveDecision.BLOCK
    if(allowAct&&level>=threshold) return ProactiveDecision.ACT
    if(level>=SEVERITY_ORDER.indexOf(SignalSeverity.MEDIUM)) return ProactiveDecision.PROPOSE
    return ProactiveDecision.IGNORE
  }
  async process(id,{hotelId=null,global=false,allowAct=true,executeSingle=null,context={}}={}){
    const scope=normalizeSignalScope({hotelId,global}); const item=await this.store.get(id); if(!item) throw new Error(`Unknown signal: ${id}`)
    if(item.hotelId){ if(scope.hotelId!==item.hotelId) throw new Error(`Proactive signal hotel scope mismatch for ${id}`) }
    else if(item.global===true){ if(!scope.global) throw new Error(`Proactive signal ${id} requires explicit global scope`) }
    else throw new Error(`Proactive signal ${id} has invalid scope`)
    const decision=this.decide(item,{allowAct}); item.decision=decision
    if(decision===ProactiveDecision.IGNORE){ item.status=SignalStatus.SUPPRESSED; item.updatedAt=nowIso(); await this.store.save(item); return clone(item) }
    if(decision===ProactiveDecision.BLOCK){ item.status=SignalStatus.BLOCKED; item.updatedAt=nowIso(); await this.store.save(item); await this.#emit('PROACTIVE_SIGNAL_BLOCKED',{id,hotelId:item.hotelId,global:item.global}); return clone(item) }
    if(decision===ProactiveDecision.PROPOSE||!this.supervisor){ item.status=SignalStatus.PROPOSED; item.updatedAt=nowIso(); await this.store.save(item); await this.#emit('PROACTIVE_PROPOSAL_CREATED',{id,hotelId:item.hotelId,global:item.global}); return clone(item) }
    const run=await this.supervisor.run({objective:`Resolve proactive signal ${item.type}: ${item.title}`,projectId:item.projectId,hotelId:item.hotelId,taskId:item.id,complexity:item.severity===SignalSeverity.HIGH?'HIGH':'LOW',executeSingle,context:{...clone(context),hotelId:item.hotelId,signal:clone(item)}})
    item.supervisorRunId=run.id; item.status=run.status==='SUCCEEDED'?SignalStatus.ACTIONED:run.status==='BLOCKED'?SignalStatus.BLOCKED:SignalStatus.PROPOSED; item.updatedAt=nowIso(); await this.store.save(item); await this.#emit('PROACTIVE_SUPERVISOR_COMPLETED',{id,hotelId:item.hotelId,global:item.global,runId:run.id,status:run.status}); return clone(item)
  }
  async resolve(id,{hotelId=null,global=false,reason=null}={}){ const scope=normalizeSignalScope({hotelId,global}); const item=await this.store.get(id); if(!item) throw new Error(`Unknown signal: ${id}`); if(item.hotelId&&scope.hotelId!==item.hotelId) throw new Error(`Proactive signal hotel scope mismatch for ${id}`); if(item.global===true&&!scope.global) throw new Error(`Proactive signal ${id} requires explicit global scope`); item.status=SignalStatus.RESOLVED; item.resolvedAt=nowIso(); item.updatedAt=item.resolvedAt; item.resolution=reason; await this.store.save(item); return clone(item) }
  async #emit(type,data){ if(!this.eventSink) return; const event={type,at:nowIso(),...clone(data)}; try{ await this.eventSink(event) }catch(error){ if(this.onTelemetryError){ try{ await this.onTelemetryError({event:clone(event),error}) }catch{} } } }
}
