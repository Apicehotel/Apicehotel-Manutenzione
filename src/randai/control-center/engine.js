import { ControlSection, classifyControlItem, controlItemMatchesScope, normalizeControlScope } from './contracts.js'
const clone=v=>structuredClone(v)

export class RandAIControlCenter {
  constructor({taskStore=null,supervisorStore=null,signalStore=null,traceStore=null,approvalStore=null,discoveryStore=null,learningStore=null}={}){
    this.taskStore=taskStore; this.supervisorStore=supervisorStore; this.signalStore=signalStore; this.traceStore=traceStore; this.approvalStore=approvalStore; this.discoveryStore=discoveryStore; this.learningStore=learningStore
  }
  async snapshot({projectId='randai',hotelId=null,allHotels=false}={}){
    if(!String(projectId||'').trim()) throw new TypeError('projectId is required')
    const scope=normalizeControlScope({hotelId,allHotels})
    const filters=scope.hotelId?{projectId,hotelId:scope.hotelId}:{projectId}
    const [tasks,supervisorRuns,signals,traces,approvals,discoveries,learning]=await Promise.all([
      this.taskStore?.list?.(filters)||[], this.supervisorStore?.list?.(filters)||[], this.signalStore?.list?.(filters)||[], this.traceStore?.list?.(filters)||[], this.approvalStore?.list?.(filters)||[], this.discoveryStore?.list?.(filters)||[], this.learningStore?.list?.(filters)||[]
    ])
    const items=[]
    for(const [kind,list] of [['TASK',tasks],['SUPERVISOR',supervisorRuns],['SIGNAL',signals],['TRACE',traces],['APPROVAL',approvals],['DISCOVERY',discoveries],['LEARNING',learning]]){
      for(const raw of list||[]){
        if(!scope.allHotels&&!controlItemMatchesScope(raw,scope)) continue
        items.push({kind,section:classifyControlItem(raw),id:raw.id,status:raw.status||null,title:raw.title||raw.name||raw.objective||raw.type||raw.id,hotelId:raw.hotelId||raw.hotel_id||raw.scope?.hotelId||null,updatedAt:raw.updatedAt||raw.createdAt||raw.startedAt||null,data:clone(raw)})
      }
    }
    items.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
    const sections=Object.fromEntries(Object.values(ControlSection).map(s=>[s,items.filter(i=>i.section===s)]))
    return {projectId,hotelId:scope.hotelId,allHotels:scope.allHotels,generatedAt:new Date().toISOString(),counts:Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.length])),sections,items}
  }
}
