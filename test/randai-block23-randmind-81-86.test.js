import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MemoryStore, RandMind, MemoryLifecycle, RetentionClass, detectMemoryConflicts, evaluateRandMindProductionGate, memoryQuality } from '../src/randai/memory/index.js'
import { EcosystemStatus, getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

const source={kind:'intervention',id:'INT-1'}
const base={scope:'hotel',hotelId:'hotelgio',source,trust:'verified',confidence:0.95,importance:0.8,lastVerifiedAt:'2026-09-03T20:00:00.000Z'}

test('81: RandMind facade reuses canonical MemoryEngine/Store and deduplicates',async()=>{
  const mind=new RandMind({store:new MemoryStore()})
  const first=await mind.remember({...base,content:'Lampadina corridoio 1101 sostituita con LED E27'})
  const second=await mind.remember({...base,content:'Lampadina corridoio 1101 sostituita con LED E27'})
  assert.equal(first.deduplicated,false)
  assert.equal(second.deduplicated,true)
  assert.equal(second.memory.id,first.memory.id)
})

test('82-83: operational episodic memory exposes temporal timeline and verified recall',async()=>{
  const store=new MemoryStore(), mind=new RandMind({store})
  await mind.remember({...base,id:'m1',content:'Motore ventilconvettore sostituito',validFrom:'2026-09-01T10:00:00.000Z'})
  await mind.remember({...base,id:'m2',content:'Motore ventilconvettore verificato funzionante',validFrom:'2026-09-02T10:00:00.000Z'})
  const timeline=await mind.timeline({hotelId:'hotelgio'})
  assert.deepEqual(timeline.map((m)=>m.id),['m1','m2'])
  const recall=await mind.recall('motore ventilconvettore',{hotelId:'hotelgio'})
  assert.ok(recall.length>=1)
  assert.equal(recall.every((m)=>m.quality.usable),true)
})

test('84: quality fails closed and conflicts are explicit',()=>{
  const q=memoryQuality({...base,id:'q',content:'Dato verificato',lifecycleStatus:'active',retentionClass:'operational'})
  assert.equal(q.usable,true)
  const conflicts=detectMemoryConflicts([
    {...base,id:'a',content:'A',conflictGroup:'room-1101-temp',lifecycleStatus:'active',retentionClass:'operational'},
    {...base,id:'b',content:'B',conflictGroup:'room-1101-temp',lifecycleStatus:'active',retentionClass:'operational'},
  ])
  assert.deepEqual(conflicts,[{group:'room-1101-temp',ids:['a','b']}])
})

test('85: retention and forgetting semantics are fail closed',()=>{
  const forgotten={...base,id:'f',content:'Vecchio dato',lifecycleStatus:MemoryLifecycle.FORGOTTEN,retentionClass:RetentionClass.OPERATIONAL,forgottenAt:'2026-09-03T20:00:00.000Z'}
  assert.equal(memoryQuality(forgotten).usable,false)
  const gate=evaluateRandMindProductionGate({memories:[forgotten]})
  assert.equal(gate.ready,true)
  const broken=evaluateRandMindProductionGate({memories:[{...base,id:'t',content:'temporanea',lifecycleStatus:'active',retentionClass:'transient'}]})
  assert.equal(broken.ready,false)
  assert.ok(broken.blockers.some((b)=>b.code==='TRANSIENT_WITHOUT_EXPIRY'))
})

test('86: RandMind is LIVE only with DB governance, console and production gate evidence',()=>{
  const manifest=getRandEcosystemManifest()
  const mind=manifest.find((m)=>m.id==='randmind')
  assert.equal(mind.status,EcosystemStatus.LIVE)
  assert.ok(mind.evidence.includes('src/randai/control/RandMindConsole.jsx'))
  assert.ok(mind.evidence.includes('supabase/migrations/20260903223000_randmind_live_81_86.sql'))
  const migration=fs.readFileSync(new URL('../supabase/migrations/20260903223000_randmind_live_81_86.sql',import.meta.url),'utf8')
  assert.match(migration,/randmind_cross_scope_supersession_denied/)
  assert.match(migration,/retention_class='legal_hold'/)
  assert.match(migration,/randmind_forget_memory/)
  assert.match(migration,/revoke all on function public\.randmind_forget_memory\(text,text\) from public,anon/)
  const ecosystem=fs.readFileSync(new URL('../src/randai/control/EcosystemConsole.jsx',import.meta.url),'utf8')
  assert.match(ecosystem,/RandMindConsole/)
})
