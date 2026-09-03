import { BrainAutonomyLevel } from './contracts.js'
import { routeBrainObjective } from './router.js'

export function benchmarkRandBrainRouter(cases=[]){
  if(!Array.isArray(cases)||!cases.length)throw new TypeError('benchmark cases are required')
  let passed=0
  const results=cases.map(item=>{const actual=routeBrainObjective(item.objective).primary;const ok=actual===item.expected;passed+=ok?1:0;return {...item,actual,ok}})
  return {total:cases.length,passed,score:Math.round((passed/cases.length)*100),results}
}

export async function faultInjectRandBrain(brain){
  const evidence=[{source:'fault-injection',verified:true,verifiedAt:new Date().toISOString()}]
  const critical=brain.plan({objective:'esegui intervento critico',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SAFE_EXECUTE,risk:'critical'})
  const costly=brain.plan({objective:'analizza guasto',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SUGGEST,estimatedCost:brain.maxEstimatedCost+1})
  let mismatchBlocked=false
  try{await brain.run({objective:'test mismatch',hotelId:'hotelgio',evidence,autonomyLevel:BrainAutonomyLevel.SAFE_EXECUTE,risk:'low',context:{hotelId:'chocohotel'},executeSingle:async()=>({ok:true,status:'SUCCEEDED'})})}catch{mismatchBlocked=true}
  return {criticalNeedsApproval:critical.decision==='REQUEST_APPROVAL',costBudgetBlocked:costly.blockers.includes('COST_BUDGET_EXCEEDED'),crossHotelBlocked:mismatchBlocked}
}
