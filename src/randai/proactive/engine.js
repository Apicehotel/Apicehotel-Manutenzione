import { ProactiveDecision, SEVERITY_ORDER, SignalSeverity, SignalStatus, validateSignal } from './contracts.js'
import { ProactiveSignalStore } from './store.js'
const clone=v=>structuredClone(v)
const nowIso=()=>new Date().toISOString()
const makeId=()=>`SIG-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2,9)}`}`

export class ProactiveEngine {
  constructor({store=new ProactiveSignalStore(),supervisor=null,eventSink=null,cooldownMs=15*60*1000,actThreshold=SignalSeverity.HIGH}={}){
    this.store=store; this.supervisor=supervisor; this.eventSink=eventSink; this.cooldownMs=cooldownMs; this.actThreshold=actThreshold
  }
  async ingest({projectId='randai',type,fingerprint,severity=SignalSeverity.MEDIUM,title=null,data={},source=null}={}){
    if(!type||!fingerprint) throw new TypeError('type and fingerprint are required')
    const existing=await this.store.findOpenByFingerprint(projectId,fingerprint)
    if(existing){
      const within=Date.now()-new Date(existing.updatedAt).getTime()<this.cooldownMs
      const item={...existing,count:(existing.count||1)+1,lastData:clone(data),updatedAt:nowIso(),lastSeenAt:nowIso(),sources:[...new Set([...(existing.sources||[]),source].filter(Boolean))]}
      if(within) item.suppressedDuplicates=(item.suppressedDuplicates||0)+1
      await this.store.save(item); await this.#emit('PROACTIVE_SIGNAL_DEDUPED',{id:item.id,fingerprint,count:item.count,withinCooldown:within}); return clone(item)
    }
    const item={id:makeId(),projectId,type,fingerprint,severity,status:SignalStatus.OPEN,title:title||type,count:1,data:clone(data),sources:source?[source]:[],createdAt:nowIso(),updatedAt:nowIso(),lastSeenAt:nowIso(),resolvedAt:null,decision:null,supervisorRunId:null}
    validateSignal(item); await this.store.save(item); await this.#emit('PROACTIVE_SIGNAL_OPENED',{id:item.id,type,severity}); return clone(item)
  }
  decide(signal,{allowAct=true}={}){
    const level=SEVERITY_ORDER.indexOf(signal.severity); const threshold=SEVERITY_ORDER.indexOf(this.actThreshold)
    if(signal.severity===SignalSeverity.CRITICAL) return ProactiveDecision.BLOCK
    if(allowAct&&level>=threshold) return ProactiveDecision.ACT
    if(level>=SEVERITY_ORDER.indexOf(SignalSeverity.MEDIUM)) return ProactiveDecision.PROPOSE
    return ProactiveDecision.IGNORE
  }
  async process(id,{allowAct=true,executeSingle=null,context={}}={}){
    const item=await this.store.get(id); if(!item) throw new Error(`Unknown signal: ${id}`)
    const decision=this.decide(item,{allowAct}); item.decision=decision
    if(decision===ProactiveDecision.IGNORE){ item.status=SignalStatus.SUPPRESSED; item.updatedAt=nowIso(); await this.store.save(item); return clone(item) }
    if(decision===ProactiveDecision.BLOCK){ item.status=SignalStatus.BLOCKED; item.updatedAt=nowIso(); await this.store.save(item); await this.#emit('PROACTIVE_SIGNAL_BLOCKED',{id}); return clone(item) }
    if(decision===ProactiveDecision.PROPOSE||!this.supervisor){ item.status=SignalStatus.PROPOSED; item.updatedAt=nowIso(); await this.store.save(item); await this.#emit('PROACTIVE_PROPOSAL_CREATED',{id}); return clone(item) }
    const run=await this.supervisor.run({objective:`Resolve proactive signal ${item.type}: ${item.title}`,projectId:item.projectId,taskId:item.id,complexity:item.severity===SignalSeverity.HIGH?'HIGH':'LOW',executeSingle,context:{...clone(context),signal:clone(item)}})
    item.supervisorRunId=run.id; item.status=run.status==='SUCCEEDED'?SignalStatus.ACTIONED:run.status==='BLOCKED'?SignalStatus.BLOCKED:SignalStatus.PROPOSED; item.updatedAt=nowIso(); await this.store.save(item); await this.#emit('PROACTIVE_SUPERVISOR_COMPLETED',{id,runId:run.id,status:run.status}); return clone(item)
  }
  async resolve(id,{reason=null}={}){ const item=await this.store.get(id); if(!item) throw new Error(`Unknown signal: ${id}`); item.status=SignalStatus.RESOLVED; item.resolvedAt=nowIso(); item.updatedAt=item.resolvedAt; item.resolution=reason; await this.store.save(item); return clone(item) }
  async #emit(type,data){ if(this.eventSink) await this.eventSink({type,at:nowIso(),...clone(data)}) }
}
