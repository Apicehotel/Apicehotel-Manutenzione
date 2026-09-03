export function buildReasoningGraph({objective,evidence=[],route,autonomyDecision}={}){
  const nodes=[
    {id:'problem',type:'problem',value:String(objective||'')},
    ...evidence.map((item,index)=>({id:`evidence-${index+1}`,type:'evidence',value:item.source,verified:item.verified!==false,verifiedAt:item.verifiedAt})),
    {id:'hypothesis',type:'hypothesis',value:`route:${route?.primary||'analysis'}`},
    {id:'plan',type:'plan',value:route?.secondary?[route.primary,route.secondary]:[route?.primary||'analysis']},
    {id:'authorization',type:'authorization',value:autonomyDecision},
    {id:'verification',type:'verification',value:'required'},
    {id:'recovery',type:'recovery',value:'rollback-or-escalate'},
  ]
  const edges=[['problem','hypothesis'],...evidence.map((_,i)=>[`evidence-${i+1}`,'hypothesis']),['hypothesis','plan'],['plan','authorization'],['authorization','verification'],['verification','recovery']]
  return {nodes,edges:edges.map(([from,to])=>({from,to}))}
}
