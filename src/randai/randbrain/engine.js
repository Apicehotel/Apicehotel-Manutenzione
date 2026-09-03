import { BrainAutonomyLevel, BrainDecision, assertEvidence, validateBrainRequest } from './contracts.js'
import { buildBrainAgentTasks, routeBrainObjective } from './router.js'
import { buildReasoningGraph } from './reasoning-graph.js'

function decide(level,risk='normal'){
  if(level===BrainAutonomyLevel.READ_ONLY)return BrainDecision.READ
  if(level===BrainAutonomyLevel.SUGGEST)return BrainDecision.SUGGEST
  if(level===BrainAutonomyLevel.APPROVAL_REQUIRED)return BrainDecision.REQUEST_APPROVAL
  if(level===BrainAutonomyLevel.SAFE_EXECUTE)return ['high','critical'].includes(String(risk).toLowerCase())?BrainDecision.REQUEST_APPROVAL:BrainDecision.EXECUTE
  return BrainDecision.STOP
}

export class RandBrain {
  constructor({supervisor,agentRegistry=null,autonomyEngine=null,actionGateway=null,maxEstimatedCost=10}={}){
    if(!supervisor)throw new TypeError('supervisor is required')
    if(!Number.isFinite(Number(maxEstimatedCost))||Number(maxEstimatedCost)<0)throw new TypeError('maxEstimatedCost must be a finite number >= 0')
    this.supervisor=supervisor;this.agentRegistry=agentRegistry;this.autonomyEngine=autonomyEngine;this.actionGateway=actionGateway;this.maxEstimatedCost=Number(maxEstimatedCost)
  }
  plan(input={}){
    validateBrainRequest(input);assertEvidence(input.evidence)
    const route=routeBrainObjective(input.objective,{availableDomains:input.availableDomains})
    const autonomyLevel=input.autonomyLevel||BrainAutonomyLevel.SUGGEST
    const decision=decide(autonomyLevel,input.risk)
    const graph=buildReasoningGraph({objective:input.objective,evidence:input.evidence,route,autonomyDecision:decision})
    const estimatedCost=Number(input.estimatedCost||0)
    const blockers=[]
    if(!Number.isFinite(estimatedCost)||estimatedCost<0)blockers.push('INVALID_COST_ESTIMATE')
    if(estimatedCost>this.maxEstimatedCost)blockers.push('COST_BUDGET_EXCEEDED')
    if(decision===BrainDecision.EXECUTE&&!this.actionGateway)blockers.push('ACTION_GATEWAY_REQUIRED')
    const routedAgentTasks=input.agentTasks?.length?structuredClone(input.agentTasks):buildBrainAgentTasks({route,objective:input.objective,hotelId:input.hotelId})
    return {hotelId:input.hotelId,objective:input.objective,route,autonomyLevel,decision,graph,estimatedCost,routedAgentTasks,blockers,canExecute:decision===BrainDecision.EXECUTE&&!blockers.length}
  }
  async run(input={}){
    const plan=this.plan(input)
    if(plan.blockers.length)return {...plan,status:'BLOCKED'}
    if([BrainDecision.READ,BrainDecision.SUGGEST,BrainDecision.REQUEST_APPROVAL].includes(plan.decision))return {...plan,status:plan.decision==='REQUEST_APPROVAL'?'NEEDS_APPROVAL':'PLANNED'}

    if(this.autonomyEngine?.evaluateOperationalAction&&input.autonomyAction){
      const policy=await this.autonomyEngine.evaluateOperationalAction({...input.autonomyAction,hotelId:input.hotelId,contextValid:true})
      if(policy.disposition==='CONFIRM')return {...plan,status:'NEEDS_APPROVAL',policy}
      if(policy.disposition!=='AUTO')return {...plan,status:'BLOCKED',policy}
    }

    const tasks=plan.routedAgentTasks.length>1?plan.routedAgentTasks:[]
    const result=await this.supervisor.run({
      objective:input.objective,hotelId:input.hotelId,
      context:{...(input.context||{}),hotelId:input.hotelId,randbrainRoute:plan.route},
      complexity:input.complexity||'LOW',capabilityGaps:input.capabilityGaps||[],agentTasks:tasks,budget:input.budget||{},executeSingle:input.executeSingle,
    })
    if(result.status!=='SUCCEEDED')this.supervisor.recordFailure({fingerprint:`randbrain:${plan.route.primary}:${result.stopReason||result.status}`,hotelId:input.hotelId,context:{hotelId:input.hotelId}})

    let gatewayResult=null
    if(result.status==='SUCCEEDED'&&input.gatewayRequest){
      const execute=this.actionGateway?.executeGovernedRandAIAction||this.actionGateway?.execute
      if(typeof execute!=='function')return {...plan,status:'BLOCKED',result,blockers:['ACTION_GATEWAY_EXECUTOR_REQUIRED']}
      gatewayResult=await execute({...input.gatewayRequest,hotelId:input.hotelId})
    }
    return {...plan,status:result.status,result,gatewayResult,verifiedOutcome:result.status==='SUCCEEDED'}
  }
}
export { decide as decideBrainAutonomy }
