import test from 'node:test'
import assert from 'node:assert/strict'
import { ProactiveEngine } from '../src/randai/proactive/engine.js'
import { ProactiveSignalStore } from '../src/randai/proactive/store.js'
import { SignalStatus } from '../src/randai/proactive/contracts.js'
import { RandAIControlCenter } from '../src/randai/control-center/engine.js'

class ListStore { constructor(items=[]){this.items=items} async list(){return structuredClone(this.items)} }

test('proactive engine deduplicates repeated signals inside cooldown', async()=>{
  const store=new ProactiveSignalStore(); const engine=new ProactiveEngine({store,cooldownMs:60_000})
  const a=await engine.ingest({type:'BUILD_FAILED',fingerprint:'build:main',severity:'HIGH',source:'github'})
  const b=await engine.ingest({type:'BUILD_FAILED',fingerprint:'build:main',severity:'HIGH',source:'ci'})
  assert.equal(a.id,b.id); assert.equal(b.count,2); assert.equal(b.suppressedDuplicates,1); assert.deepEqual(b.sources.sort(),['ci','github'])
})

test('critical proactive signal fails closed instead of acting', async()=>{
  let called=0
  const engine=new ProactiveEngine({supervisor:{run:async()=>{called+=1;return {id:'x',status:'SUCCEEDED'}}}})
  const signal=await engine.ingest({type:'PROD_DELETE',fingerprint:'prod-delete',severity:'CRITICAL'})
  const result=await engine.process(signal.id,{allowAct:true,executeSingle:async()=>({ok:true})})
  assert.equal(result.status,SignalStatus.BLOCKED); assert.equal(called,0)
})

test('high signal is routed through supervisor and records action', async()=>{
  const supervisor={run:async(input)=>({id:'SUP-1',status:'SUCCEEDED',input})}
  const engine=new ProactiveEngine({supervisor,actThreshold:'HIGH'})
  const signal=await engine.ingest({type:'TEST_FAILURE',fingerprint:'test:a',severity:'HIGH'})
  const result=await engine.process(signal.id,{executeSingle:async()=>({ok:true})})
  assert.equal(result.status,SignalStatus.ACTIONED); assert.equal(result.supervisorRunId,'SUP-1')
})

test('control center projects engine state into operational sections', async()=>{
  const cc=new RandAIControlCenter({
    taskStore:new ListStore([{id:'T1',status:'RUNNING',objective:'Build fix'}]),
    signalStore:new ListStore([{id:'S1',status:'PROPOSED',type:'BUILD_FAILED'}]),
    approvalStore:new ListStore([{id:'A1',status:'PENDING',name:'GitHub write'}]),
    supervisorStore:new ListStore([{id:'R1',status:'SUCCEEDED',objective:'Review'}])
  })
  const snap=await cc.snapshot({projectId:'randai'})
  assert.equal(snap.counts.ACTIVE,1); assert.equal(snap.counts.PROPOSALS,1); assert.equal(snap.counts.BLOCKED,1); assert.equal(snap.counts.COMPLETED,1)
})
