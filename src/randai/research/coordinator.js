import { RandResearch, ResearchStatus } from './runtime.js'

const clean=(v)=>String(v??'').trim()
const frozen=(v)=>Object.freeze(structuredClone(v))

export function authorizeResearch({actor,hotelId,targetHotelId,grantedScopes=[]}={}){
 if(!actor?.id)return frozen({allowed:false,code:'ACTOR_REQUIRED'})
 const source=clean(hotelId),target=clean(targetHotelId||hotelId);if(!source||!target)return frozen({allowed:false,code:'HOTEL_SCOPE_REQUIRED'})
 if(source!==target)return frozen({allowed:false,code:'CROSS_HOTEL_DENIED'})
 const scopes=new Set(grantedScopes);if(!scopes.has('research:execute'))return frozen({allowed:false,code:'RESEARCH_SCOPE_DENIED'})
 if(!scopes.has('knowledge:read'))return frozen({allowed:false,code:'KNOWLEDGE_SCOPE_DENIED'})
 return frozen({allowed:true,code:'ALLOW',hotelId:source,actorId:clean(actor.id)})
}

export class RandResearchCoordinator{
 constructor({research=new RandResearch(),sourceAdapter,knowledgeGateway=null,synthesizer=null}={}){
  if(!sourceAdapter?.search)throw new TypeError('RandResearch sourceAdapter.search is required')
  this.research=research;this.sourceAdapter=sourceAdapter;this.knowledgeGateway=knowledgeGateway;this.synthesizer=synthesizer
 }
 async run(request,{actor,hotelId,targetHotelId,grantedScopes=[]}={}){
  const auth=authorizeResearch({actor,hotelId,targetHotelId,grantedScopes});if(!auth.allowed)return frozen({authorization:auth,status:'DENIED'})
  if(clean(request?.hotelId)&&clean(request.hotelId)!==auth.hotelId)return frozen({authorization:frozen({allowed:false,code:'REQUEST_HOTEL_MISMATCH'}),status:'DENIED'})
  let session=await this.research.start({...request,hotelId:auth.hotelId})
  const internal=[]
  if(this.knowledgeGateway?.query){const k=await this.knowledgeGateway.query(session.canonicalQuery,{actor,hotelId:auth.hotelId,targetHotelId:auth.hotelId,grantedScopes,limit:Math.min(8,session.budget.sources)});for(const hit of k.hits||[])internal.push({id:`knowledge:${hit.id}`,hotelId:auth.hotelId,source:{kind:`knowledge:${hit.backend}`,id:hit.id,uri:`rand://${hit.canonicalRef.kind}/${hit.canonicalRef.id}`},title:`Internal knowledge ${hit.id}`,excerpt:hit.content,tier:'PRIMARY',claims:[],coverage:[],directness:.95,recency:.8,corroboration:.8,retrievalConfidence:Math.min(1,Number(hit.confidence)||.8)})}
  const external=await this.sourceAdapter.search({canonicalQuery:session.canonicalQuery,subqueries:session.subqueries,hotelId:auth.hotelId,level:session.level,maxSources:session.budget.sources,recencyDays:Number(request?.recencyDays)||0})
  session=await this.research.addSources(session.sessionId,[...internal,...(Array.isArray(external)?external:[])])
  const report=this.synthesizer?.synthesize?await this.synthesizer.synthesize(frozen(session)):{summary:session.sources.slice(0,5).map((s)=>s.excerpt).join(' ').slice(0,4000),sourceIds:session.sources.map((s)=>s.sourceId),findings:[],limitations:session.gaps.map((g)=>g.requirement)}
  session=await this.research.finalize(session.sessionId,report)
  return frozen({authorization:auth,status:session.status,session,requiresHumanReview:session.status!==ResearchStatus.READY||['L3','L4'].includes(session.level)})
 }
}
