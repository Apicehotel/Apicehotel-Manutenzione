import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { EcosystemStatus, getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'
import { assertVikingEvaluation, evaluateOpenViking } from '../src/randai/viking/evaluation.js'
import { buildTieredAuthorizedContext } from '../src/randai/viking/context-projection.js'
import { evaluateVikingProductionGate } from '../src/randai/viking/production-gate.js'
import { ContextEngine } from '../src/randai/context/engine.js'

test('99 evaluates OpenViking through the canonical Repo Radar and blocks full adoption',()=>{
  const result=evaluateOpenViking()
  assert.equal(assertVikingEvaluation(result),true)
  assert.equal(result.report.decision,'REJECT')
  assert.equal(result.decision,'ADOPT_PATTERNS_ONLY')
  assert.equal(result.installAllowed,false)
  assert.ok(result.duplicatedAuthorities.includes('memory'))
  assert.ok(result.operationalCosts.includes('context-database'))
})

test('99 adopts tiered loading only as an authorized stateless projection',()=>{
  const result=buildTieredAuthorizedContext({hotelId:'hotelgio',query:'caldaia',evidence:[
    {id:'ok',hotelId:'hotelgio',authorized:true,source:'RandGuide',content:'Procedura autorizzata'},
    {id:'foreign',hotelId:'chocohotel',authorized:true,source:'RandMind',content:'Altro hotel'},
    {id:'denied',hotelId:'hotelgio',authorized:false,source:'draft',content:'Non autorizzata'},
  ]})
  assert.deepEqual(result.tiers.L0.map((item)=>item.id),['ok'])
  assert.equal(result.tiers.L2.length,0)
  assert.equal(result.persisted,false)
  assert.equal(result.trace[0].source,'RandGuide')
})

test('99 requires explicit scope and never leaks another hotel into L2',()=>{
  assert.throws(()=>buildTieredAuthorizedContext({evidence:[]}),/hotelId/)
  const result=buildTieredAuthorizedContext({hotelId:'brigantino',includeDetails:true,evidence:[{id:'b',hotelId:'brigantino',authorized:true,source:'RandMind',details:'dettaglio'},{id:'g',hotelId:'hotelgio',authorized:true,source:'RandMind',details:'segreto'}]})
  assert.equal(result.tiers.L2.length,1)
  assert.equal(result.tiers.L2[0].id,'b')
})

test('99 production gate and control surface are evidence backed',()=>{
  assert.equal(evaluateVikingProductionGate().status,'PASSED')
  const module=getRandEcosystemManifest().find((item)=>item.id==='viking')
  assert.equal(module.status,EcosystemStatus.EVALUATED)
  assert.ok(module.evidence.includes('src/randai/viking/evaluation.js'))
  assert.match(fs.readFileSync('src/randai/control/EcosystemConsole.jsx','utf8'),/VikingConsole/)
  assert.match(fs.readFileSync('.github/workflows/ci.yml','utf8'),/Viking evaluation and pattern adoption gate/)
})

test('99 is wired into ContextEngine without changing its default contract',async()=>{
  const memoryEngine={recall:async()=>[{id:'m1',type:'episodic',trust:'verified',content:'Pompa verificata',score:1,source:{kind:'RandMind'}}]}
  const engine=new ContextEngine({memoryEngine})
  const classic=await engine.build({query:'pompa',hotelId:'hotelgio'})
  assert.equal(classic.progressiveContext,undefined)
  const tiered=await engine.build({query:'pompa',hotelId:'hotelgio',tiered:true})
  assert.equal(tiered.progressiveContext.tiers.L0[0].id,'m1')
  assert.equal(tiered.progressiveContext.authority,'AuthorizedContextEngine')
})
