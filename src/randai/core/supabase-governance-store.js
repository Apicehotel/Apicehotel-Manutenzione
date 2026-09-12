import { createAuditRecord, createRandRule } from './governance-runtime.js'

const fail=(error,context)=>{ if(error){ const e=new Error(`${context}: ${error.message||error}`); e.cause=error; throw e } }
const rowToRule=(r)=>createRandRule({id:r.id,version:r.version,enabled:r.enabled,priority:r.priority,eventType:r.event_type,scope:r.scope,hotelId:r.hotel_id,condition:r.condition,intent:{actionType:r.action_type,risk:r.risk,requiredScopes:r.required_scopes||[],params:r.action_params||{}}})
const rowToAudit=(r)=>createAuditRecord({auditId:r.audit_id,kind:r.kind,occurredAt:new Date(r.occurred_at).getTime(),scope:r.scope,hotelId:r.hotel_id,actorId:r.actor_id,eventId:r.event_id,jobId:r.job_id,intentId:r.intent_id,correlationId:r.correlation_id,decision:r.decision,reasonCodes:r.reason_codes||[],details:r.details||{}})

export class SupabaseRandGovernanceStore {
  constructor(client){ if(!client?.from) throw new TypeError('Supabase service-role client required'); this.client=client }
  async listRules({eventType,hotelId}={}) {
    let q=this.client.from('rand_governance_rules').select('*').eq('enabled',true).order('priority',{ascending:false}).order('id',{ascending:true})
    if(eventType) q=q.eq('event_type',eventType)
    if(hotelId) q=q.or(`scope.eq.SYSTEM,and(scope.eq.HOTEL,hotel_id.eq.${hotelId})`); else q=q.eq('scope','SYSTEM')
    const {data,error}=await q; fail(error,'list governance rules'); return (data||[]).map(rowToRule)
  }
  async appendAudit(record) {
    const r=createAuditRecord(record); const {data,error}=await this.client.from('rand_governance_audit').insert({audit_id:r.auditId,kind:r.kind,occurred_at:new Date(r.occurredAt).toISOString(),scope:r.scope,hotel_id:r.hotelId,actor_id:r.actorId,event_id:r.eventId,job_id:r.jobId,intent_id:r.intentId,correlation_id:r.correlationId,decision:r.decision,reason_codes:r.reasonCodes,details:r.details}).select('*').single()
    fail(error,'append governance audit'); return rowToAudit(data)
  }
  async listAudit({hotelId,correlationId,limit=200}={}) {
    let q=this.client.from('rand_governance_audit').select('*').order('occurred_at',{ascending:false}).limit(Math.min(500,Math.max(1,Number(limit)||200)))
    if(hotelId) q=q.eq('hotel_id',hotelId); if(correlationId) q=q.eq('correlation_id',correlationId)
    const {data,error}=await q; fail(error,'list governance audit'); return (data||[]).map(rowToAudit)
  }
}
