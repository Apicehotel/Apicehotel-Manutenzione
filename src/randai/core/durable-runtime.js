import { traceRandAIOperation } from './ai-observability.js'
import { assertDurableStore } from './durable-store-contract.js'

export const DurableStatus = Object.freeze({ PENDING:'PENDING', RUNNING:'RUNNING', WAITING:'WAITING', SUCCEEDED:'SUCCEEDED', FAILED:'FAILED', CANCELLED:'CANCELLED' })
const TERMINAL = new Set([DurableStatus.SUCCEEDED, DurableStatus.FAILED, DurableStatus.CANCELLED])
const clean = (v) => String(v || '').trim()
const freeze = (v) => Object.freeze(v)

export function authorizeDurableRun({ actor, hotelId, targetHotelId, grantedScopes=[] }={}) {
  if (!actor?.id) return freeze({allowed:false,code:'ACTOR_REQUIRED'})
  const source=clean(hotelId), target=clean(targetHotelId||hotelId)
  if (!source||!target) return freeze({allowed:false,code:'HOTEL_SCOPE_REQUIRED'})
  if (source!==target) return freeze({allowed:false,code:'CROSS_HOTEL_DENIED'})
  if (!new Set(grantedScopes).has('workflow:execute')) return freeze({allowed:false,code:'SCOPE_DENIED'})
  return freeze({allowed:true,code:'ALLOW',hotelId:source,actorId:clean(actor.id)})
}

export class InMemoryDurableStore {
  constructor(){this.runs=new Map();this.idempotency=new Map()}
  async get(id){return this.runs.get(id)||null}
  async put(run){this.runs.set(run.id,structuredClone(run));return run}
  async byKey(key){const id=this.idempotency.get(key);return id?this.get(id):null}
  async bindKey(key,id){if(key)this.idempotency.set(key,id)}
}

export class RandDurableRuntime {
  constructor({store=new InMemoryDurableStore(),clock=()=>Date.now(),reauthorize,refreshKnowledge}={}){
    this.store=assertDurableStore(store);this.clock=clock
    this.reauthorize=reauthorize||(async(c)=>authorizeDurableRun(c));this.refreshKnowledge=refreshKnowledge||(async()=>null)
  }
  async start({workflow,input={},context={},idempotencyKey,maxAttempts=3}={}){
    if(!workflow?.id||typeof workflow.execute!=='function')throw new TypeError('Workflow id and execute() are required')
    const key=clean(idempotencyKey);if(!key)throw new TypeError('Idempotency key is required')
    const existing=await this.store.byKey(key);if(existing)return existing
    const auth=await this.reauthorize(context);if(!auth?.allowed)return freeze({status:'DENIED',authorization:auth})
    const now=this.clock(),run={id:`run_${now}_${Math.random().toString(36).slice(2,10)}`,workflowId:clean(workflow.id),workflowVersion:clean(workflow.version||'1'),hotelId:auth.hotelId,actorId:auth.actorId,input:structuredClone(input),checkpoint:null,attempt:0,maxAttempts:Math.max(1,Number(maxAttempts)||3),status:DurableStatus.PENDING,idempotencyKey:key,createdAt:now,updatedAt:now}
    await this.store.put(run);await this.store.bindKey(key,run.id);return this.resume({runId:run.id,workflow,context})
  }
  async resume({runId,workflow,context={}}={}){
    const run=await this.store.get(runId);if(!run)throw new Error('Durable run not found');if(TERMINAL.has(run.status))return run
    if(clean(workflow?.id)!==run.workflowId||clean(workflow?.version||'1')!==run.workflowVersion)return this.#finish(run,DurableStatus.FAILED,{errorCode:'WORKFLOW_VERSION_MISMATCH'})
    const auth=await this.reauthorize({...context,hotelId:run.hotelId,targetHotelId:run.hotelId})
    if(!auth?.allowed||auth.actorId!==run.actorId)return this.#finish(run,DurableStatus.FAILED,{errorCode:'REAUTHORIZATION_FAILED'})
    const knowledge=await this.refreshKnowledge({run,context:{...context,hotelId:run.hotelId}});run.status=DurableStatus.RUNNING;run.attempt+=1;run.updatedAt=this.clock();await this.store.put(run)
    return traceRandAIOperation('durable.resume',{'rand.hotel_id':run.hotelId,'rand.workflow_id':run.workflowId,'rand.workflow_attempt':run.attempt},async()=>{
      try{const result=await workflow.execute({input:structuredClone(run.input),checkpoint:structuredClone(run.checkpoint),knowledge,run:freeze({...run})});if(result?.wait===true){run.checkpoint=structuredClone(result.checkpoint??run.checkpoint);return this.#finish(run,DurableStatus.WAITING)}return this.#finish(run,DurableStatus.SUCCEEDED,{output:structuredClone(result?.output??result)})}
      catch(error){if(run.attempt<run.maxAttempts&&error?.retryable===true){run.checkpoint=structuredClone(error.checkpoint??run.checkpoint);return this.#finish(run,DurableStatus.WAITING,{errorCode:clean(error.code||'RETRYABLE_ERROR')})}return this.#finish(run,DurableStatus.FAILED,{errorCode:clean(error?.code||'WORKFLOW_FAILED')})}
    })
  }
  async cancel(runId){const run=await this.store.get(runId);if(!run||TERMINAL.has(run.status))return run;return this.#finish(run,DurableStatus.CANCELLED)}
  async #finish(run,status,extra={}){Object.assign(run,extra,{status,updatedAt:this.clock()});await this.store.put(run);return freeze(structuredClone(run))}
}
