import { FindingSeverity, HealthStatus } from './health-snapshot.js'

export const RandRisk = Object.freeze({ LOW:'LOW', MEDIUM:'MEDIUM', HIGH:'HIGH', CRITICAL:'CRITICAL' })
export const RandSecurityDecision = Object.freeze({ ELIGIBLE:'ELIGIBLE', REQUIRE_APPROVAL:'REQUIRE_APPROVAL', DENY:'DENY' })
export const RandAuditKind = Object.freeze({ RULE_MATCH:'RULE_MATCH', SECURITY_DECISION:'SECURITY_DECISION', DOCTOR_FINDING:'DOCTOR_FINDING', ACTION_OUTCOME:'ACTION_OUTCOME' })

const clone = (v) => structuredClone(v)
const clean = (v) => String(v ?? '').trim()
const frozen = (v) => Object.freeze(clone(v))
const idDefault = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2,10)}`}`
const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|service[_-]?role|api[_-]?key|pin)/i

function readPath(obj, path) {
  return clean(path).split('.').filter(Boolean).reduce((value,key) => value == null ? undefined : value[key], obj)
}
function leafMatches(leaf, data) {
  if (!leaf || typeof leaf !== 'object' || Array.isArray(leaf)) throw new TypeError('Rule condition leaf must be an object')
  const path = clean(leaf.path); const op = clean(leaf.op).toLowerCase(); const actual = readPath(data,path)
  if (!path || !['eq','neq','in','not_in','gt','gte','lt','lte','exists'].includes(op)) throw new TypeError('Unsupported rule condition')
  if (op === 'exists') return leaf.value === false ? actual == null : actual != null
  if (op === 'eq') return Object.is(actual, leaf.value)
  if (op === 'neq') return !Object.is(actual, leaf.value)
  if (op === 'in' || op === 'not_in') {
    if (!Array.isArray(leaf.value)) throw new TypeError(`${op} requires array value`)
    const included = leaf.value.some((item) => Object.is(item,actual)); return op === 'in' ? included : !included
  }
  if (typeof actual !== 'number' || typeof leaf.value !== 'number') return false
  return op === 'gt' ? actual > leaf.value : op === 'gte' ? actual >= leaf.value : op === 'lt' ? actual < leaf.value : actual <= leaf.value
}
export function matchesRandCondition(condition, data) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) throw new TypeError('Rule condition must be an object')
  if (Array.isArray(condition.all)) return condition.all.every((item)=>matchesRandCondition(item,data))
  if (Array.isArray(condition.any)) return condition.any.some((item)=>matchesRandCondition(item,data))
  if (condition.not) return !matchesRandCondition(condition.not,data)
  return leafMatches(condition,data)
}
export function createRandRule(rule = {}) {
  const id = clean(rule.id); const eventType = clean(rule.eventType); const scope = clean(rule.scope || (rule.hotelId ? 'HOTEL':'SYSTEM')).toUpperCase()
  const hotelId = clean(rule.hotelId) || null; const actionType = clean(rule.intent?.actionType); const risk = clean(rule.intent?.risk || RandRisk.LOW).toUpperCase()
  if (!id || !eventType || !actionType) throw new TypeError('Rule id, eventType and intent.actionType are required')
  if (!['HOTEL','SYSTEM'].includes(scope)) throw new TypeError('Rule scope must be HOTEL or SYSTEM')
  if (scope === 'HOTEL' && !hotelId) throw new TypeError('HOTEL rule requires hotelId')
  if (scope === 'SYSTEM' && hotelId) throw new TypeError('SYSTEM rule cannot carry hotelId')
  if (!Object.values(RandRisk).includes(risk)) throw new TypeError('Unknown rule risk')
  matchesRandCondition(rule.condition ?? {path:'event.type',op:'exists'}, {event:{type:eventType}})
  return frozen({ id, version:Math.max(1,Number(rule.version)||1), enabled:rule.enabled !== false, priority:Number(rule.priority)||0,
    eventType, scope, hotelId, condition:clone(rule.condition ?? {path:'event.type',op:'exists'}),
    intent:{ actionType, risk, requiredScopes:[...new Set((rule.intent?.requiredScopes || []).map(clean).filter(Boolean))], params:clone(rule.intent?.params || {}) } })
}

export class RandRulesEngine {
  constructor({rules=[]}={}) { this.rules = rules.map(createRandRule).sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id)) }
  evaluate(event,{idFactory=idDefault}={}) {
    if (!event?.eventId || !event?.type || !['HOTEL','SYSTEM'].includes(event?.scope)) throw new TypeError('Canonical RandCore event required')
    const matches=[]
    for (const rule of this.rules) {
      if (!rule.enabled || rule.eventType !== event.type || rule.scope !== event.scope) continue
      if (rule.scope === 'HOTEL' && rule.hotelId !== event.hotelId) continue
      if (!matchesRandCondition(rule.condition,{event})) continue
      matches.push(frozen({ intentId:idFactory('intent'), ruleId:rule.id, ruleVersion:rule.version, eventId:event.eventId,
        correlationId:event.correlationId || event.eventId, scope:event.scope, hotelId:event.hotelId || null,
        actionType:rule.intent.actionType, risk:rule.intent.risk, requiredScopes:rule.intent.requiredScopes, params:rule.intent.params }))
    }
    return matches
  }
}

export class RandSecure {
  constructor({allowedActionTypes=[]}={}) { this.allowedActionTypes = new Set(allowedActionTypes.map(clean).filter(Boolean)) }
  decide(intent,{actorId,hotelId,scopes=[],permissionGranted=false,approvalPresent=false}={}) {
    const reasons=[]; const actor = clean(actorId); const actorHotel=clean(hotelId)||null; const actorScopes=new Set(scopes.map(clean))
    if (!intent?.intentId || !intent?.actionType || !Object.values(RandRisk).includes(intent?.risk)) reasons.push('INVALID_INTENT')
    if (!actor) reasons.push('ACTOR_REQUIRED')
    if (!this.allowedActionTypes.has(clean(intent?.actionType))) reasons.push('ACTION_NOT_ALLOWLISTED')
    if (intent?.scope === 'HOTEL' && (!intent.hotelId || actorHotel !== intent.hotelId)) reasons.push('HOTEL_SCOPE_MISMATCH')
    if (intent?.scope === 'SYSTEM' && intent?.hotelId) reasons.push('INVALID_SYSTEM_SCOPE')
    const missing=(intent?.requiredScopes || []).filter((scope)=>!actorScopes.has(scope)); if (missing.length) reasons.push('MISSING_SCOPE')
    if (!permissionGranted) reasons.push('PERMISSION_NOT_GRANTED')
    if (intent?.risk === RandRisk.CRITICAL && !actorScopes.has('critical:execute')) reasons.push('CRITICAL_SCOPE_REQUIRED')
    if (reasons.length) return frozen({decision:RandSecurityDecision.DENY,reasons,missingScopes:missing,intentId:intent?.intentId||null})
    if ([RandRisk.MEDIUM,RandRisk.HIGH,RandRisk.CRITICAL].includes(intent.risk) && !approvalPresent)
      return frozen({decision:RandSecurityDecision.REQUIRE_APPROVAL,reasons:['HUMAN_APPROVAL_REQUIRED'],missingScopes:[],intentId:intent.intentId})
    return frozen({decision:RandSecurityDecision.ELIGIBLE,reasons:['BOUNDARY_CHECKS_PASSED'],missingScopes:[],intentId:intent.intentId})
  }
}

export function redactAuditDetails(value, seen=new WeakSet()) {
  if (value == null || typeof value !== 'object') return value
  if (seen.has(value)) return '[CIRCULAR]'; seen.add(value)
  if (Array.isArray(value)) return value.map((item)=>redactAuditDetails(item,seen))
  const out={}; for (const [key,val] of Object.entries(value)) out[key]=SENSITIVE_KEY.test(key)?'[REDACTED]':redactAuditDetails(val,seen)
  return out
}
export function createAuditRecord(input={}, {clock=()=>Date.now(),idFactory=idDefault}={}) {
  const kind=clean(input.kind).toUpperCase(); const scope=clean(input.scope || (input.hotelId?'HOTEL':'SYSTEM')).toUpperCase(); const hotelId=clean(input.hotelId)||null
  if (!Object.values(RandAuditKind).includes(kind)) throw new TypeError('Unknown audit kind')
  if (!['HOTEL','SYSTEM'].includes(scope) || (scope==='HOTEL'&&!hotelId) || (scope==='SYSTEM'&&hotelId)) throw new TypeError('Invalid audit scope')
  const occurredAt=Number(input.occurredAt ?? clock()); if (!Number.isFinite(occurredAt)) throw new TypeError('Audit occurredAt must be finite')
  return frozen({auditId:clean(input.auditId)||idFactory('audit'),kind,occurredAt,scope,hotelId,
    actorId:clean(input.actorId)||null,eventId:clean(input.eventId)||null,jobId:clean(input.jobId)||null,intentId:clean(input.intentId)||null,
    correlationId:clean(input.correlationId)||null,decision:clean(input.decision)||null,reasonCodes:[...new Set((input.reasonCodes||[]).map(clean).filter(Boolean))],
    details:redactAuditDetails(input.details||{})})
}
export class InMemoryRandGovernanceStore {
  constructor({rules=[]}={}) { this.rules=rules.map(createRandRule); this.audit=[] }
  async listRules({eventType,hotelId}={}) { return this.rules.filter((r)=>(!eventType||r.eventType===eventType) && (r.scope==='SYSTEM'||!hotelId||r.hotelId===hotelId)).map(clone) }
  async appendAudit(record) { const value=createAuditRecord(record); if (this.audit.some((r)=>r.auditId===value.auditId)) throw new Error('AUDIT_ID_COLLISION'); this.audit.push(value); return clone(value) }
  async listAudit({hotelId,correlationId}={}) { return this.audit.filter((r)=>(!hotelId||r.hotelId===hotelId)&&(!correlationId||r.correlationId===correlationId)).map(clone) }
}

export class RandDoctor {
  inspect({randCoreSnapshot={},healthChecks=[]}={}, {clock=()=>Date.now(),idFactory=idDefault}={}) {
    const findings=[]; const push=(severity,code,title,details={})=>findings.push(frozen({findingId:idFactory('finding'),severity,code,title,details,detectedAt:clock()}))
    for (const worker of randCoreSnapshot.workers || []) if (worker.status === 'STALE') push(FindingSeverity.HIGH,'STALE_WORKER','Worker RandCore stale',{workerId:worker.id})
    for (const job of randCoreSnapshot.jobs || []) if (job.status === 'DEAD_LETTER') push(FindingSeverity.HIGH,'DEAD_LETTER_JOB','Job in dead-letter',{jobId:job.id,errorCode:job.errorCode||null})
    const dlq = randCoreSnapshot.deadLetters || []; if (dlq.length) push(FindingSeverity.HIGH,'DEAD_LETTER_BACKLOG','Dead-letter da revisionare',{count:dlq.length})
    for (const check of healthChecks || []) {
      if (check.status === HealthStatus.CRITICAL) push(FindingSeverity.CRITICAL,'HEALTH_CRITICAL','Health check critico',{checkId:check.id||check.name||null})
      else if (check.status === HealthStatus.DEGRADED) push(FindingSeverity.HIGH,'HEALTH_DEGRADED','Health check degradato',{checkId:check.id||check.name||null})
      else if (check.status === HealthStatus.UNKNOWN) push(FindingSeverity.WARN,'HEALTH_UNKNOWN','Health check senza evidenza sufficiente',{checkId:check.id||check.name||null})
    }
    return frozen({status:findings.some((f)=>f.severity===FindingSeverity.CRITICAL)?'CRITICAL':findings.some((f)=>f.severity===FindingSeverity.HIGH)?'DEGRADED':findings.length?'ATTENTION':'HEALTHY',findings})
  }
}

export class RandGovernanceRuntime {
  constructor({store,secure,doctor=new RandDoctor(),clock=()=>Date.now(),idFactory=idDefault}={}) {
    if (!store?.listRules || !store?.appendAudit) throw new TypeError('Governance store must implement listRules() and appendAudit()')
    if (!secure?.decide) throw new TypeError('RandSecure instance required')
    this.store=store; this.secure=secure; this.doctor=doctor; this.clock=clock; this.idFactory=idFactory
  }
  async processEvent(event, actorContext={}) {
    const rules=await this.store.listRules({eventType:event?.type,hotelId:event?.hotelId||null})
    const intents=new RandRulesEngine({rules}).evaluate(event,{idFactory:this.idFactory}); const results=[]
    for (const intent of intents) {
      await this.store.appendAudit(createAuditRecord({auditId:this.idFactory('audit'),kind:RandAuditKind.RULE_MATCH,occurredAt:this.clock(),scope:intent.scope,hotelId:intent.hotelId,actorId:actorContext.actorId,eventId:intent.eventId,intentId:intent.intentId,correlationId:intent.correlationId,decision:'MATCHED',reasonCodes:['RULE_MATCHED'],details:{ruleId:intent.ruleId,ruleVersion:intent.ruleVersion,actionType:intent.actionType,risk:intent.risk}},{clock:this.clock,idFactory:this.idFactory}))
      const security=this.secure.decide(intent,actorContext)
      await this.store.appendAudit(createAuditRecord({auditId:this.idFactory('audit'),kind:RandAuditKind.SECURITY_DECISION,occurredAt:this.clock(),scope:intent.scope,hotelId:intent.hotelId,actorId:actorContext.actorId,eventId:intent.eventId,intentId:intent.intentId,correlationId:intent.correlationId,decision:security.decision,reasonCodes:security.reasons,details:{actionType:intent.actionType,risk:intent.risk,missingScopes:security.missingScopes}},{clock:this.clock,idFactory:this.idFactory}))
      results.push(frozen({intent,security}))
    }
    return frozen({eventId:event.eventId,correlationId:event.correlationId||event.eventId,results})
  }
  async diagnose(input,{scope='SYSTEM',hotelId=null,actorId='randdoctor'}={}) {
    const report=this.doctor.inspect(input,{clock:this.clock,idFactory:this.idFactory})
    for (const finding of report.findings) await this.store.appendAudit(createAuditRecord({auditId:this.idFactory('audit'),kind:RandAuditKind.DOCTOR_FINDING,occurredAt:finding.detectedAt,scope,hotelId,actorId,decision:report.status,reasonCodes:[finding.code],details:{severity:finding.severity,title:finding.title,...finding.details}},{clock:this.clock,idFactory:this.idFactory}))
    return report
  }
}
