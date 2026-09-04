import test from 'node:test'
import assert from 'node:assert/strict'
import { EcosystemStatus, assertRandEcosystemManifest, getRandEcosystemManifest, summarizeRandEcosystem } from '../src/randai/core/ecosystem.js'
import { RAND_CONFIG_DEFINITIONS, buildEffectiveRandConfig, getRandConfigDefinition, validateRandConfigValue } from '../src/randai/core/configuration.js'

test('point 51: ecosystem truth map distinguishes live, partial and planned modules',()=>{
  const modules=getRandEcosystemManifest()
  assert.equal(assertRandEcosystemManifest(modules),true)
  assert.equal(modules.find((m)=>m.id==='randai').status,EcosystemStatus.LIVE)
  const randguide=modules.find((m)=>m.id==='randguide')
  assert.equal(randguide.status,EcosystemStatus.LIVE)
  assert.ok(randguide.evidence?.length>0,'RandGuide LIVE must remain evidence-backed')
  const randAudio=modules.find((m)=>m.id==='randaudio')
  assert.equal(randAudio.status,EcosystemStatus.PARTIAL)
  assert.ok(randAudio.evidence.length>0)
  assert.equal(modules.find((m)=>m.id==='viking').status,EcosystemStatus.EVALUATED)
  const summary=summarizeRandEcosystem(modules)
  assert.equal(summary.total,modules.length)
  assert.ok(summary.unfinished>0)
})

test('point 52: RandCore manifest fails closed on duplicate or fake LIVE entries',()=>{
  assert.throws(()=>assertRandEcosystemManifest([
    {id:'x',name:'X',status:EcosystemStatus.LIVE,evidence:[]},
  ]),/LIVE module without evidence/)
  assert.throws(()=>assertRandEcosystemManifest([
    {id:'x',name:'X',status:EcosystemStatus.PLANNED,evidence:[]},
    {id:'x',name:'X2',status:EcosystemStatus.PLANNED,evidence:[]},
  ]),/Duplicate/)
})

test('point 54: configuration validates typed bounded non-secret values',()=>{
  const budget=getRandConfigDefinition('budgets','max_request_cost_usd')
  assert.deepEqual(validateRandConfigValue(budget,2.5),{ok:true,value:2.5})
  assert.equal(validateRandConfigValue(budget,-1).ok,false)
  assert.equal(validateRandConfigValue(budget,101).ok,false)
  const autonomy=getRandConfigDefinition('autonomy','default_mode')
  assert.equal(validateRandConfigValue(autonomy,'AUTO_ANYTHING').ok,false)
  assert.equal(RAND_CONFIG_DEFINITIONS.some((def)=>def.secret),false)
})

test('point 54: hotel override wins over global and defaults without cross-hotel bleed',()=>{
  const rows=[
    {hotel_id:null,section:'models',key:'primary_provider',value:'global-provider',version:1,enabled:true},
    {hotel_id:'hotelgio',section:'models',key:'primary_provider',value:'gio-provider',version:2,enabled:true},
    {hotel_id:'chocohotel',section:'budgets',key:'max_daily_cost_usd',value:10,version:1,enabled:true},
  ]
  const gio=buildEffectiveRandConfig(rows,'hotelgio')
  const choco=buildEffectiveRandConfig(rows,'chocohotel')
  assert.equal(gio['models.primary_provider'].value,'gio-provider')
  assert.equal(gio['models.primary_provider'].source,'HOTEL')
  assert.equal(choco['models.primary_provider'].value,'global-provider')
  assert.equal(gio['budgets.max_daily_cost_usd'].value,25)
  assert.equal(choco['budgets.max_daily_cost_usd'].value,10)
})
