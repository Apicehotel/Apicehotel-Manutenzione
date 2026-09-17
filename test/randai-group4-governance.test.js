import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RandRulesEngine,RandSecure,RandRisk,RandSecurityDecision,RandAuditKind,InMemoryRandGovernanceStore,RandDoctor,RandGovernanceRuntime,createAuditRecord,redactAuditDetails } from '../src/randai/core/governance-runtime.js'

const hotelEvent={eventId:'evt_1',type:'maintenance.alert',source:'test',scope:'HOTEL',hotelId:'gio',occurredAt:1,correlationId:'corr_1',causationId:null,payload:{severity:8}}
const rule={id:'r1',version:1,eventType:'maintenance.alert',scope:'HOTEL',hotelId:'gio',priority:10,condition:{all:[{path:'event.payload.severity',op:'gte',value:7},{path:'event.hotelId',op:'eq',value:'gio'}]},intent:{actionType:'maintenance.notify',risk:'MEDIUM',requiredScopes:['maintenance:write'],params:{channel:'reception'}}}

test('RandRules matches declaratively and is hotel scoped',()=>{
 const engine=new RandRulesEngine({rules:[rule,{...rule,id:'r2',hotelId:'choco'}]}); const out=engine.evaluate(hotelEvent,{idFactory:()=> 'intent_1'})
 assert.equal(out.length,1); assert.equal(out[0].ruleId,'r1'); assert.equal(out[0].hotelId,'gio'); assert.equal(out[0].risk,RandRisk.MEDIUM)
})

test('RandSecure restricts but never grants around existing boundaries',()=>{
 const [intent]=new RandRulesEngine({rules:[rule]}).evaluate(hotelEvent,{idFactory:()=> 'intent_1'})
 const secure=new RandSecure({allowedActionTypes:['maintenance.notify']})
 assert.equal(secure.decide(intent,{actorId:'u1',hotelId:'gio',scopes:['maintenance:write'],permissionGranted:true}).decision,RandSecurityDecision.REQUIRE_APPROVAL)
 assert.equal(secure.decide(intent,{actorId:'u1',hotelId:'choco',scopes:['maintenance:write'],permissionGranted:true,approvalPresent:true}).decision,RandSecurityDecision.DENY)
 assert.equal(secure.decide(intent,{actorId:'u1',hotelId:'gio',scopes:['maintenance:write'],permissionGranted:true,approvalPresent:true}).decision,RandSecurityDecision.ELIGIBLE)
})

test('critical intent needs critical scope and human approval',()=>{
 const critical={...rule,id:'critical',intent:{...rule.intent,risk:'CRITICAL'}}; const [intent]=new RandRulesEngine({rules:[critical]}).evaluate(hotelEvent,{idFactory:()=> 'i'})
 const secure=new RandSecure({allowedActionTypes:['maintenance.notify']})
 assert.equal(secure.decide(intent,{actorId:'u',hotelId:'gio',scopes:['maintenance:write'],permissionGranted:true,approvalPresent:true}).decision,RandSecurityDecision.DENY)
 assert.equal(secure.decide(intent,{actorId:'u',hotelId:'gio',scopes:['maintenance:write','critical:execute'],permissionGranted:true}).decision,RandSecurityDecision.REQUIRE_APPROVAL)
})

test('audit redacts secrets and is append-only by contract',async()=>{
 const details=redactAuditDetails({ok:1,token:'abc',nested:{service_role:'xyz',safe:'yes'}}); assert.equal(details.token,'[REDACTED]'); assert.equal(details.nested.service_role,'[REDACTED]'); assert.equal(details.nested.safe,'yes')
 const store=new InMemoryRandGovernanceStore(); const record=createAuditRecord({auditId:'a1',kind:RandAuditKind.SECURITY_DECISION,scope:'HOTEL',hotelId:'gio',details:{password:'x'}},{clock:()=>1})
 await store.appendAudit(record); await assert.rejects(()=>store.appendAudit(record),/AUDIT_ID_COLLISION/); assert.equal((await store.listAudit({hotelId:'gio'}))[0].details.password,'[REDACTED]')
})

test('RandDoctor composes existing health evidence instead of creating a second health owner',()=>{
 const report=new RandDoctor().inspect({randCoreSnapshot:{workers:[{id:'w1',status:'STALE'}],jobs:[{id:'j1',status:'DEAD_LETTER',errorCode:'X'}],deadLetters:[{id:'d1'}]},healthChecks:[{id:'db',status:'UNKNOWN'}]},{clock:()=>1,idFactory:(p)=>`${p}_x`})
 assert.equal(report.status,'DEGRADED'); assert.ok(report.findings.some((f)=>f.code==='STALE_WORKER')); assert.ok(report.findings.some((f)=>f.code==='DEAD_LETTER_BACKLOG')); assert.ok(report.findings.some((f)=>f.code==='HEALTH_UNKNOWN'))
})

test('RandGovernanceRuntime connects rule, secure and immutable evidence without executing actions',async()=>{
 let seq=0; const store=new InMemoryRandGovernanceStore({rules:[rule]}); const runtime=new RandGovernanceRuntime({store,secure:new RandSecure({allowedActionTypes:['maintenance.notify']}),clock:()=>10,idFactory:(p)=>`${p}_${++seq}`})
 const result=await runtime.processEvent(hotelEvent,{actorId:'u1',hotelId:'gio',scopes:['maintenance:write'],permissionGranted:true})
 assert.equal(result.results.length,1); assert.equal(result.results[0].security.decision,RandSecurityDecision.REQUIRE_APPROVAL)
 const audit=await store.listAudit({hotelId:'gio',correlationId:'corr_1'}); assert.equal(audit.length,2); assert.deepEqual(audit.map((r)=>r.kind),[RandAuditKind.RULE_MATCH,RandAuditKind.SECURITY_DECISION])
})

test('RandGovernanceRuntime persists doctor findings as audit evidence',async()=>{
 let seq=0; const store=new InMemoryRandGovernanceStore(); const runtime=new RandGovernanceRuntime({store,secure:new RandSecure(),clock:()=>20,idFactory:(p)=>`${p}_${++seq}`})
 const report=await runtime.diagnose({randCoreSnapshot:{workers:[{id:'w1',status:'STALE'}]}},{scope:'HOTEL',hotelId:'gio'})
 assert.equal(report.findings.length,1); const audit=await store.listAudit({hotelId:'gio'}); assert.equal(audit.length,1); assert.equal(audit[0].kind,RandAuditKind.DOCTOR_FINDING)
})

test('database contract is RLS locked and audit immutable',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20260912122000_rand_governance_v1.sql',import.meta.url),'utf8')
 for(const table of ['rand_governance_rules','rand_governance_audit']){ assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,'i')); assert.match(sql,new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`,'i')) }
 assert.match(sql,/grant select,insert on table public\.rand_governance_audit to service_role/i); assert.doesNotMatch(sql,/grant[^;]*update[^;]*rand_governance_audit/i)
 assert.match(sql,/before update or delete on public\.rand_governance_audit/i); assert.match(sql,/RAND_GOVERNANCE_AUDIT_IMMUTABLE/i)
})
