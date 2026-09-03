import test from 'node:test'
import assert from 'node:assert/strict'
import { BrainAutonomyLevel, BrainDecision, RandBrain, RandBrainLearningAdapter, buildReasoningGraph, decideBrainAutonomy, evaluateRandBrainReadiness, routeBrainObjective } from '../src/randai/randbrain/index.js'

const evidence=[{source:'verified:issue-1',verified:true,verifiedAt:'2026-09-03T20:00:00Z'}]

test('87 canonical RandBrain composes supervisor instead of replacing it',()=>{
  const supervisor={run:async()=>({status:'SUCCEEDED'}),recordFailure:()=>({})}
  const brain=new RandBrain({supervisor,actionGateway:{}})
  const plan=brain.plan({objective:'lampadina guasta camera',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SUGGEST})
  assert.equal(plan.hotelId,'hotelgio');assert.equal(plan.route.primary,'maintenance')
})

test('88 routing selects only useful specialist domains',()=>{
  assert.equal(routeBrainObjective('pezzo ricambio magazzino').primary,'warehouse')
  assert.equal(routeBrainObjective('bug frontend deploy').primary,'software')
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

test('90 execution requires Action Gateway boundary',()=>{
  const brain=new RandBrain({supervisor:{run:async()=>({status:'SUCCEEDED'}),recordFailure:()=>({})}})
  const plan=brain.plan({objective:'esegui manutenzione',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SAFE_EXECUTE,risk:'low'})
  assert.deepEqual(plan.blockers,['ACTION_GATEWAY_REQUIRED']);assert.equal(plan.canExecute,false)
})

test('91 learning reuses governed LearningEngine and forwards only verified scoped evidence',async()=>{
  let observed=null
  const adapter=new RandBrainLearningAdapter({learningEngine:{observe:async(x)=>{observed=x;return {status:'OBSERVED'}}}})
  await adapter.observeVerifiedOutcome({hotelId:'hotelgio',problemClass:'hvac',strategy:'check sensor',outcome:'SUCCEEDED',runId:'run-1'})
  assert.equal(observed.verified,true);assert.equal(observed.hotelId,'hotelgio');assert.equal(observed.metadata.outcome,'SUCCEEDED')
  assert.throws(()=>new RandBrainLearningAdapter({learningEngine:{}}),/observe/)
})

test('91 learning requires evidence identity',async()=>{
  const adapter=new RandBrainLearningAdapter({learningEngine:{observe:async()=>({})}})
  await assert.rejects(()=>adapter.observeVerifiedOutcome({hotelId:'hotelgio',problemClass:'x',strategy:'y',outcome:'FAILED'}),/source.id or runId/)
})

test('92 production gate is fail-closed and reaches LIVE_READY only with all evidence',()=>{
  assert.equal(evaluateRandBrainReadiness({canonicalFacade:true}).status,'BLOCKED')
  const yes={canonicalFacade:true,dynamicRouting:true,reasoningGraph:true,autonomyGoverned:true,verifiedLearning:true,hotelIsolation:true,actionGatewayBoundary:true,rollback:true,costBudget:true,faultInjection:true,benchmark:true}
  const result=evaluateRandBrainReadiness(yes);assert.equal(result.status,'LIVE_READY');assert.equal(result.score,100)
})
