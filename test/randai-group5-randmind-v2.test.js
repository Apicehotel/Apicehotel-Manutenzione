import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MemoryScope,MemoryTrust } from '../src/randai/memory/contracts.js'
import { MemoryStore } from '../src/randai/memory/store.js'
import { RandMind,MemoryLifecycle,RetentionClass,memoryQuality } from '../src/randai/memory/randmind.js'
import { memoryFromVerifiedAudit,planRetention,suggestConflictWinner,usableAt } from '../src/randai/memory/evidence.js'

const audit={auditId:'a1',kind:'ACTION_OUTCOME',occurredAt:Date.parse('2026-09-12T06:00:00Z'),scope:'HOTEL',hotelId:'gio',intentId:'i1',correlationId:'c1',decision:'SUCCEEDED',reasonCodes:['OUTCOME_VERIFIED']}

test('verified governance outcome becomes provenance-bound memory and unverified outcome is rejected',()=>{
 const m=memoryFromVerifiedAudit(audit,{content:'Filtro manutenzione verificato',confidence:.9})
 assert.equal(m.scope,MemoryScope.HOTEL); assert.equal(m.hotelId,'gio'); assert.equal(m.trust,MemoryTrust.VERIFIED); assert.equal(m.source.kind,'governance_audit'); assert.equal(m.source.id,'a1')
 assert.throws(()=>memoryFromVerifiedAudit({...audit,reasonCodes:[]},{content:'x'}),/Verified outcome/)
 assert.throws(()=>memoryFromVerifiedAudit({...audit,hotelId:'gio'},{content:'x',hotelId:'choco'}),/scope mismatch/)
})

test('task success alone stays suggested and cannot silently become verified truth',async()=>{
 const store=new MemoryStore(); const mind=new RandMind({store})
 const created=await mind.engine.extractFromTask({id:'task-1',status:'SUCCEEDED',objective:'Controllo pompa',metadata:{hotelId:'gio'},decisions:[{type:'RETRY',reason:'Verifica pressione'}]})
 assert.equal(created.length,2); assert.ok(created.every((m)=>m.trust===MemoryTrust.SUGGESTED)); assert.ok(created.every((m)=>!m.lastVerifiedAt)); assert.ok(created.every((m)=>m.tags.includes('unverified-outcome')))
})

test('temporal usability preserves historical truth before supersession and forgetting',()=>{
 const base={id:'m1',type:'episodic',scope:'hotel',hotelId:'gio',trust:'verified',content:'old',source:{kind:'test',id:'s'},importance:.5,confidence:.9,createdAt:'2026-01-01T00:00:00Z',validFrom:'2026-01-01T00:00:00Z',validUntil:null,lifecycleStatus:MemoryLifecycle.SUPERSEDED,retentionClass:RetentionClass.LONG_TERM,supersededAt:'2026-06-01T00:00:00Z'}
 assert.equal(usableAt(base,'2026-05-01T00:00:00Z'),true); assert.equal(usableAt(base,'2026-07-01T00:00:00Z'),false)
})

test('retention planner is non-destructive, policy-driven and never selects legal hold',()=>{
 const items=[
  {id:'t',lifecycleStatus:'active',retentionClass:'transient',updatedAt:'2026-01-01T00:00:00Z'},
  {id:'l',lifecycleStatus:'active',retentionClass:'legal_hold',updatedAt:'2020-01-01T00:00:00Z'},
  {id:'o',lifecycleStatus:'active',retentionClass:'operational',updatedAt:'2026-01-01T00:00:00Z'}]
 const plan=planRetention(items,{transient:7},Date.parse('2026-02-01T00:00:00Z')); assert.deepEqual(plan.candidates.map(x=>x.id),['t']); assert.equal(items[0].lifecycleStatus,'active')
})

test('conflict suggestion is explainable and refuses score ties',()=>{
 const common={type:'episodic',scope:'hotel',hotelId:'gio',source:{kind:'x',id:'y'},importance:.5,lifecycleStatus:'active',retentionClass:'long_term',validFrom:'2026-01-01T00:00:00Z'}
 const result=suggestConflictWinner([{...common,id:'a',trust:'approved',confidence:.95,content:'a'},{...common,id:'b',trust:'draft',confidence:.6,content:'b'}],Date.parse('2026-02-01T00:00:00Z'),memoryQuality)
 assert.equal(result.winnerId,'a'); assert.equal(result.ambiguous,false); assert.equal(result.ranked[0].id,'a')
 const tie=suggestConflictWinner([{...common,id:'c',trust:'verified',confidence:.9,content:'c'},{...common,id:'d',trust:'verified',confidence:.9,content:'d'}],Date.parse('2026-02-01T00:00:00Z'),memoryQuality)
 assert.equal(tie.ambiguous,true); assert.equal(tie.winnerId,null)
})

test('in-memory governed conflict resolution mirrors production scope rules',async()=>{
 const store=new MemoryStore(); const mind=new RandMind({store}); const common={type:'episodic',scope:'hotel',hotelId:'gio',source:{kind:'test',id:'src'},importance:.7,confidence:.9,retentionClass:'long_term',validFrom:'2026-01-01T00:00:00Z',conflictGroup:'pump-state'}
 await mind.remember({...common,id:'winner',trust:'verified',content:'Pompa operativa'}); await mind.remember({...common,id:'loser',trust:'verified',content:'Pompa guasta'})
 const out=await mind.resolveConflict({conflictGroup:'pump-state',winnerId:'winner',loserIds:['loser'],reason:'Verifica manutentore'})
 assert.equal(out.supersededCount,1); const loser=await store.get('loser'); assert.equal(loser.lifecycleStatus,'superseded'); assert.equal(loser.trust,'outdated'); assert.ok(loser.supersededAt)
})

test('RandMind ingests verified audit and recallAt uses canonical store',async()=>{
 const mind=new RandMind({store:new MemoryStore()}); const out=await mind.ingestVerifiedAudit(audit,{content:'Pompa verificata operativa',importance:.8,confidence:.9})
 assert.equal(out.memory.source.id,'a1'); const rows=await mind.recallAt('pompa','2026-09-13T00:00:00Z',{scope:'hotel',hotelId:'gio'}); assert.equal(rows.length,1)
})

test('database v2 contract stamps supersession, deduplicates verified audit and governs conflict resolution',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20260912130000_randmind_v2.sql',import.meta.url),'utf8')
 assert.match(sql,/add column if not exists superseded_at/i); assert.match(sql,/unique index if not exists randmind_verified_audit_dedupe_idx/i)
 assert.match(sql,/create or replace function public\.randmind_resolve_conflict/i); assert.match(sql,/can_manage_randai_hotel/i); assert.match(sql,/randmind_winner_cannot_be_loser/i)
 assert.match(sql,/grant execute on function public\.randmind_resolve_conflict[\s\S]*authenticated,service_role/i)
})
