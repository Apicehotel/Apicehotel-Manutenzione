import { summarizeObservability } from '../observability/insights.js'
import { ControlSection, classifyControlItem, controlItemMatchesScope, normalizeControlScope } from './contracts.js'
const clone=v=>structuredClone(v)

const SOURCE_NAMES=['tasks','supervisorRuns','signals','traces','approvals','discoveries','learning']

export class RandAIControlCenter {
  constructor({taskStore=null,supervisorStore=null,signalStore=null,traceStore=null,approvalStore=null,discoveryStore=null,learningStore=null}={}){
    this.taskStore=taskStore; this.supervisorStore=supervisorStore; this.signalStore=signalStore; this.traceStore=traceStore; this.approvalStore=approvalStore; this.discoveryStore=discoveryStore; this.learningStore=learningStore
  }
  async #readSource(name,store,filters){
    if(!store?.list) return {name,status:'NOT_CONFIGURED',items:[]}
    try { return {name,status:'READY',items:await store.list(filters)} }
    catch(error){ return {name,status:'ERROR',items:[],error:error?.message||String(error)} }
  }
  async snapshot({projectId='randai',hotelId=null,allHotels=false}={}){
    if(!String(projectId||'').trim()) throw new TypeError('projectId is required')
    const scope=normalizeControlScope({hotelId,allHotels})
    const filters=scope.hotelId?{projectId,hotelId:scope.hotelId}:{projectId}
    const stores=[this.taskStore,this.supervisorStore,this.signalStore,this.traceStore,this.approvalStore,this.discoveryStore,this.learningStore]
    const sourceResults=await Promise.all(stores.map((store,index)=>this.#readSource(SOURCE_NAMES[index],store,filters)))
    const sourceHealth=Object.fromEntries(sourceResults.map(({name,status,error})=>[name,{status,...(error?{error}: {})}]))
    const items=[]
    for(const result of sourceResults){
      const kind=result.name==='supervisorRuns'?'SUPERVISOR':result.name.slice(0,-1).toUpperCase()
      for(const raw of result.items||[]){
        if(!scope.allHotels&&!controlItemMatchesScope(raw,scope)) continue
        items.push({kind,section:classifyControlItem(raw),id:raw.id,status:raw.status||null,title:raw.title||raw.name||raw.objective||raw.type||raw.id,hotelId:raw.hotelId||raw.hotel_id||raw.scope?.hotelId||null,updatedAt:raw.updatedAt||raw.createdAt||raw.startedAt||null,data:clone(raw)})
      }
    }
    items.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
    const sections=Object.fromEntries(Object.values(ControlSection).map(s=>[s,items.filter(i=>i.section===s)]))
    const degraded=sourceResults.some(source=>source.status==='ERROR')
    return {projectId,hotelId:scope.hotelId,allHotels:scope.allHotels,generatedAt:new Date().toISOString(),health:{status:degraded?'DEGRADED':'HEALTHY',sources:sourceHealth},counts:Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.length])),sections,items,observability:scope.hotelId?summarizeObservability({hotelId:scope.hotelId,traces:sourceResults[3].items}):null}
  }
}
