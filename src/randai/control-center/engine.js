import { ControlSection, classifyControlItem } from './contracts.js'
const clone=v=>structuredClone(v)

export class RandAIControlCenter {
  constructor({taskStore=null,supervisorStore=null,signalStore=null,traceStore=null,approvalStore=null,discoveryStore=null,learningStore=null}={}){
    this.taskStore=taskStore; this.supervisorStore=supervisorStore; this.signalStore=signalStore; this.traceStore=traceStore; this.approvalStore=approvalStore; this.discoveryStore=discoveryStore; this.learningStore=learningStore
  }
  async snapshot({projectId='randai'}={}){
    const [tasks,supervisorRuns,signals,traces,approvals,discoveries,learning]=await Promise.all([
      this.taskStore?.list?.({projectId})||[], this.supervisorStore?.list?.({projectId})||[], this.signalStore?.list?.({projectId})||[], this.traceStore?.list?.({projectId})||[], this.approvalStore?.list?.({projectId})||[], this.discoveryStore?.list?.({projectId})||[], this.learningStore?.list?.({projectId})||[]
    ])
    const items=[]
    for(const [kind,list] of [['TASK',tasks],['SUPERVISOR',supervisorRuns],['SIGNAL',signals],['TRACE',traces],['APPROVAL',approvals],['DISCOVERY',discoveries],['LEARNING',learning]]){
      for(const raw of list||[]) items.push({kind,section:classifyControlItem(raw),id:raw.id,status:raw.status||null,title:raw.title||raw.name||raw.objective||raw.type||raw.id,updatedAt:raw.updatedAt||raw.createdAt||raw.startedAt||null,data:clone(raw)})
    }
    items.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
    const sections=Object.fromEntries(Object.values(ControlSection).map(s=>[s,items.filter(i=>i.section===s)]))
    return {projectId,generatedAt:new Date().toISOString(),counts:Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.length])),sections,items}
  }
}
