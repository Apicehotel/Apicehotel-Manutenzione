import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RandResearch,ResearchLevel,ResearchStatus,createResearchPlan,normalizeResearchSource,detectResearchContradictions,evaluateResearchShipGate,researchGaps } from '../src/randai/research/runtime.js'
import { RandResearchCoordinator,authorizeResearch } from '../src/randai/research/coordinator.js'

test('research authorization is fail-closed and hotel scoped',()=>{
 assert.equal(authorizeResearch({}).code,'ACTOR_REQUIRED')
 assert.equal(authorizeResearch({actor:{id:'u'},hotelId:'gio',targetHotelId:'choco',grantedScopes:['research:execute','knowledge:read']}).code,'CROSS_HOTEL_DENIED')
 assert.equal(authorizeResearch({actor:{id:'u'},hotelId:'gio',grantedScopes:['research:execute']}).code,'KNOWLEDGE_SCOPE_DENIED')
 assert.equal(authorizeResearch({actor:{id:'u'},hotelId:'gio',grantedScopes:['research:execute','knowledge:read']}).allowed,true)
})

test('adaptive research levels are bounded and canonical query persists',()=>{
 const p=createResearchPlan({query:'perdite acqua hotel',hotelId:'gio',level:ResearchLevel.L4,requirements:['sensori','costi']},{sessionId:'r1'})
 assert.equal(p.canonicalQuery,'perdite acqua hotel'); assert.equal(p.budget.sources,120); assert.ok(p.subqueries.length<=p.budget.queries)
})

test('source normalization requires provenance and same hotel',()=>{
 const s=normalizeResearchSource({id:'s1',url:'https://example.com',hotelId:'gio',title:'Manuale',content:'Dato tecnico',tier:'AUTHORITATIVE',claims:[{key:'range',value:'10m'}]},{hotelId:'gio'})
 assert.ok(s.qualityScore>0); assert.equal(s.source.uri,'https://example.com')
 assert.throws(()=>normalizeResearchSource({...s,hotelId:'choco'},{hotelId:'gio'}),/hotel scope mismatch/)
})

test('contradictions and gaps are explicit evidence objects',()=>{
 const sources=[
  normalizeResearchSource({id:'a',url:'https://a.test',hotelId:'gio',title:'A',content:'A',tier:'PRIMARY',directness:1,corroboration:1,claims:[{key:'range',value:'10m',confidence:.9}],coverage:['costi']},{hotelId:'gio'}),
  normalizeResearchSource({id:'b',url:'https://b.test',hotelId:'gio',title:'B',content:'B',tier:'AUTHORITATIVE',directness:1,corroboration:1,claims:[{key:'range',value:'5m',confidence:.9}]},{hotelId:'gio'})]
 const c=detectResearchContradictions(sources); assert.equal(c.length,1); assert.equal(c[0].severity,'HIGH')
 const plan=createResearchPlan({query:'x',hotelId:'gio',level:'L2',requirements:['costi','sensori']}); assert.deepEqual(researchGaps(plan,sources).map(x=>x.requirement),['sensori'])
})

test('ship gate blocks injection-risk source, gaps and unresolved high contradictions',()=>{
 const plan=createResearchPlan({query:'x',hotelId:'gio',level:'L3',requirements:['req']}); const source=normalizeResearchSource({id:'a',url:'https://a.test',hotelId:'gio',title:'A',content:'A',tier:'PRIMARY',promptInjectionRisk:true,coverage:[]},{hotelId:'gio'})
 const gate=evaluateResearchShipGate({plan,sources:[source],contradictions:[],gaps:[{requirement:'req'}],report:{summary:'x',sourceIds:['a']}}); assert.equal(gate.ready,false); assert.ok(gate.blockers.some(x=>x.code==='PROMPT_INJECTION_SOURCE'))
})

test('coordinator performs bounded run and keeps human review for L3/L4',async()=>{
 const sourceAdapter={search:async({hotelId})=>[{id:'s1',url:'https://vendor.test/manual',hotelId,title:'Manuale',content:'Sensore certificato',tier:'AUTHORITATIVE',coverage:['sensori'],directness:1,recency:1,corroboration:.8}]}
 const coordinator=new RandResearchCoordinator({sourceAdapter})
 const out=await coordinator.run({query:'sensori acqua',hotelId:'gio',level:'L3',requirements:['sensori']},{actor:{id:'u'},hotelId:'gio',grantedScopes:['research:execute','knowledge:read']})
 assert.equal(out.status,ResearchStatus.READY); assert.equal(out.requiresHumanReview,true); assert.equal(out.session.sources.length,1)
})

test('audit level requires at least two high quality sources and citations',async()=>{
 const research=new RandResearch(); let s=await research.start({query:'audit',hotelId:'gio',level:'L4'}); s=await research.addSources(s.sessionId,[{id:'s1',url:'https://one.test',hotelId:'gio',title:'One',content:'One',tier:'PRIMARY',directness:1,recency:1,corroboration:1,retrievalConfidence:1}]); s=await research.finalize(s.sessionId,{summary:'report',sourceIds:['s1']}); assert.equal(s.status,ResearchStatus.BLOCKED); assert.ok(s.shipGate.blockers.some(x=>x.code==='AUDIT_NEEDS_TWO_HIGH_QUALITY_SOURCES'))
})

test('database contract is service-role only and enforces source hotel scope',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20260912143000_randresearch_v1.sql',import.meta.url),'utf8')
 for(const table of ['rand_research_sessions','rand_research_sources']){assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`,'i'));assert.match(sql,new RegExp(`revoke all on table public\\.${table} from public,anon,authenticated`,'i'))}
 assert.match(sql,/randresearch_cross_hotel_source_denied/i); assert.match(sql,/grant select,insert,update on table public\.rand_research_sessions to service_role/i)
})
