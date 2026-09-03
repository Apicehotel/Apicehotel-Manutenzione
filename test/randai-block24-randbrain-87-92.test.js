import test from 'node:test'
import assert from 'node:assert/strict'
import { LearningEngine } from '../src/randai/learning/engine.js'
import { BrainAutonomyLevel, BrainDecision, RandBrain, RandBrainLearningAdapter, benchmarkRandBrainRouter, buildReasoningGraph, decideBrainAutonomy, evaluateRandBrainReadiness, faultInjectRandBrain, routeBrainObjective } from '../src/randai/randbrain/index.js'

const evidence=[{source:'verified:issue-1',verified:true,verifiedAt:'2026-09-03T20:00:00Z'}]
const supervisor={run:async()=>({status:'SUCCEEDED',evaluation:{score:1},metrics:{agents:1,toolCalls:1,retries:0,cost:.01}}),recordFailure:()=>({})}

test('87 canonical RandBrain composes supervisor instead of replacing it',()=>{
  const brain=new RandBrain({supervisor,actionGateway:{}})
  const plan=brain.plan({objective:'lampadina guasta camera',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SUGGEST})
  assert.equal(plan.hotelId,'hotelgio');assert.equal(plan.route.primary,'maintenance')
})

test('88 routing selects only useful specialist domains',()=>{
  assert.equal(routeBrainObjective('pezzo ricambio magazzino').primary,'warehouse')
  assert.equal(routeBrainObjective('bug frontend deploy').primary,'software')
  assert.equal(routeBrainObjective('procedura blocco ascensore').primary,'procedure')
})

test('89 reasoning graph preserves evidence -> plan -> authorization -> verification -> recovery',()=>{
  const graph=buildReasoningGraph({objective:'x',evidence,route:{primary:'analysis'},autonomyDecision:'SUGGEST'})
  for(const type of ['problem','evidence','hypothesis','plan','authorization','verification','recovery'])assert.ok(graph.nodes.some(n=>n.type===type))
})

test('90 autonomy never silently escalates risky execution',()=>{
  assert.equal(decideBrainAutonomy(BrainAutonomyLevel.READ_ONLY),BrainDecision.READ)
  assert.equal(decideBrainAutonomy(BrainAutonomyLevel.SAFE_EXECUTE,'critical'),BrainDecision.REQUEST_APPROVAL)
  assert.equal(decideBrainAutonomy(BrainAutonomyLevel.APPROVAL_REQUIRED),BrainDecision.REQUEST_APPROVAL)
})

test('90 execution requires Action Gateway boundary and explicit hotel scope',()=>{
  const brain=new RandBrain({supervisor})
  const plan=brain.plan({objective:'esegui manutenzione',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SAFE_EXECUTE,risk:'low'})
  assert.deepEqual(plan.blockers,['ACTION_GATEWAY_REQUIRED']);assert.equal(plan.canExecute,false)
  assert.throws(()=>brain.plan({objective:'x',hotelId:'hotelgio',context:{hotelId:'chocohotel'},evidence}),/scope mismatch/)
})

test('91 learning reuses governed LearningEngine instead of a second store',async()=>{
  const learningEngine=new LearningEngine({minEvidence:2})
  const adapter=new RandBrainLearningAdapter({learningEngine})
  const first=await adapter.observeVerifiedOutcome({hotelId:'hotelgio',problemClass:'hvac',strategy:'check sensor',outcome:'SUCCEEDED',runId:'run-1'})
  const second=await adapter.observeVerifiedOutcome({hotelId:'hotelgio',problemClass:'hvac',strategy:'check sensor',outcome:'SUCCEEDED',runId:'run-2'})
  assert.equal(first.status,'OBSERVED');assert.equal(second.status,'CANDIDATE');assert.equal(second.hotelId,'hotelgio')
})

test('91 learning requires evidence identity',async()=>{
  const adapter=new RandBrainLearningAdapter({learningEngine:{observe:async()=>({})}})
  await assert.rejects(()=>adapter.observeVerifiedOutcome({hotelId:'hotelgio',problemClass:'x',strategy:'y',outcome:'FAILED'}),/source.id or runId/)
})

test('92 benchmark and fault injection prove routing, cost, approval and hotel isolation',async()=>{
  const benchmark=benchmarkRandBrainRouter([
    {objective:'pezzo ricambio magazzino',expected:'warehouse'},
    {objective:'bug frontend deploy',expected:'software'},
    {objective:'manuale dove si trova',expected:'knowledge'},
    {objective:'lampadina guasta',expected:'maintenance'},
  ])
  assert.equal(benchmark.score,100)
  const fault=await faultInjectRandBrain(new RandBrain({supervisor,actionGateway:{},maxEstimatedCost:1}))
  assert.deepEqual(fault,{criticalNeedsApproval:true,costBudgetBlocked:true,crossHotelBlocked:true})
})

test('92 production gate is fail-closed and reaches LIVE_READY only with all evidence',()=>{
  assert.equal(evaluateRandBrainReadiness({canonicalFacade:true}).status,'BLOCKED')
  const yes={canonicalFacade:true,dynamicRouting:true,reasoningGraph:true,autonomyGoverned:true,verifiedLearning:true,hotelIsolation:true,actionGatewayBoundary:true,rollback:true,costBudget:true,faultInjection:true,benchmark:true}
  const result=evaluateRandBrainReadiness(yes);assert.equal(result.status,'LIVE_READY');assert.equal(result.score,100)
})
