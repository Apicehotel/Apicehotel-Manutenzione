import test from 'node:test'
import assert from 'node:assert/strict'
import { ProactiveEngine } from '../src/randai/proactive/engine.js'
import { ProactiveSignalStore } from '../src/randai/proactive/store.js'
import { SignalStatus } from '../src/randai/proactive/contracts.js'
import { RandAIControlCenter } from '../src/randai/control-center/engine.js'

class ListStore { constructor(items=[]){this.items=items} async list(){return structuredClone(this.items)} }

test('block 7 / point 25: identical proactive fingerprints stay isolated by hotel', async()=>{
  const store=new ProactiveSignalStore(); const engine=new ProactiveEngine({store})
  const gio=await engine.ingest({hotelId:'hotel-gio',type:'WIND_ALERT',fingerprint:'wind:terrace',severity:'HIGH'})
  const choco=await engine.ingest({hotelId:'chocohotel',type:'WIND_ALERT',fingerprint:'wind:terrace',severity:'HIGH'})
  assert.notEqual(gio.id,choco.id)
  assert.equal((await store.list({hotelId:'hotel-gio'})).length,1)
  assert.equal((await store.list({hotelId:'chocohotel'})).length,1)
})

test('block 7 / point 25: hotel-scoped proactive processing fails closed on missing or wrong hotel', async()=>{
  const engine=new ProactiveEngine({store:new ProactiveSignalStore()})
  const signal=await engine.ingest({hotelId:'hotel-gio',type:'SENSOR_STALE',fingerprint:'sensor:1',severity:'MEDIUM'})
  await assert.rejects(()=>engine.process(signal.id),/hotel scope mismatch/)
  await assert.rejects(()=>engine.process(signal.id,{hotelId:'chocohotel'}),/hotel scope mismatch/)
  const result=await engine.process(signal.id,{hotelId:'hotel-gio',allowAct:false})
  assert.equal(result.status,SignalStatus.PROPOSED)
})

test('block 7 / point 25: global proactive scope must be explicit', async()=>{
  const engine=new ProactiveEngine({store:new ProactiveSignalStore()})
  await assert.rejects(()=>engine.ingest({type:'BUILD_FAILED',fingerprint:'build:main',severity:'HIGH'}),/explicit global scope/)
  const signal=await engine.ingest({global:true,type:'BUILD_FAILED',fingerprint:'build:main',severity:'HIGH'})
  await assert.rejects(()=>engine.process(signal.id),/explicit global scope/)
  const result=await engine.process(signal.id,{global:true,allowAct:false})
  assert.equal(result.status,SignalStatus.PROPOSED)
})

test('block 7 / point 25: proactive telemetry failures are non-fatal and self-diagnostic', async()=>{
  let diagnostics=0
  const engine=new ProactiveEngine({eventSink:async()=>{throw new Error('telemetry down')},onTelemetryError:async()=>{diagnostics+=1}})
  const signal=await engine.ingest({global:true,type:'BUILD_FAILED',fingerprint:'build:telemetry',severity:'LOW'})
  assert.equal(signal.status,SignalStatus.OPEN)
  assert.equal(diagnostics,1)
})

test('block 7 / point 26: control center requires explicit hotel or all-hotels scope', async()=>{
  const cc=new RandAIControlCenter({taskStore:new ListStore([])})
  await assert.rejects(()=>cc.snapshot({projectId:'randai'}),/requires hotelId or explicit allHotels/)
})

test('block 7 / point 26: hotel snapshot cannot project another hotel data even if a store ignores filters', async()=>{
  const cc=new RandAIControlCenter({
    taskStore:new ListStore([
      {id:'G1',hotelId:'hotel-gio',status:'RUNNING',objective:'Giò'},
      {id:'C1',hotelId:'chocohotel',status:'RUNNING',objective:'Choco'}
    ]),
    signalStore:new ListStore([
      {id:'GS',hotelId:'hotel-gio',status:'PROPOSED',type:'GIO_SIGNAL'},
      {id:'CS',hotelId:'chocohotel',status:'PROPOSED',type:'CHOCO_SIGNAL'}
    ])
  })
  const snap=await cc.snapshot({projectId:'randai',hotelId:'hotel-gio'})
  assert.deepEqual(snap.items.map(x=>x.id).sort(),['G1','GS'])
  assert.equal(snap.hotelId,'hotel-gio')
  assert.equal(snap.allHotels,false)
})

test('block 7 / point 26: cross-hotel view exists only through explicit allHotels mode', async()=>{
  const cc=new RandAIControlCenter({taskStore:new ListStore([
    {id:'G1',hotelId:'hotel-gio',status:'SUCCEEDED'},
    {id:'C1',hotelId:'chocohotel',status:'SUCCEEDED'}
  ])})
  const snap=await cc.snapshot({projectId:'randai',allHotels:true})
  assert.equal(snap.items.length,2)
  assert.equal(snap.allHotels,true)
})
