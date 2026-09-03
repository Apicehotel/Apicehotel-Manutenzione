export function evaluateRandBrainReadiness(input={}){
  const checks={canonicalFacade:Boolean(input.canonicalFacade),dynamicRouting:Boolean(input.dynamicRouting),reasoningGraph:Boolean(input.reasoningGraph),autonomyGoverned:Boolean(input.autonomyGoverned),verifiedLearning:Boolean(input.verifiedLearning),hotelIsolation:Boolean(input.hotelIsolation),actionGatewayBoundary:Boolean(input.actionGatewayBoundary),rollback:Boolean(input.rollback),costBudget:Boolean(input.costBudget),faultInjection:Boolean(input.faultInjection),benchmark:Boolean(input.benchmark)}
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name)
  return {status:failed.length?'BLOCKED':'LIVE_READY',score:Math.round((Object.values(checks).filter(Boolean).length/Object.keys(checks).length)*100),checks,failed}
}
