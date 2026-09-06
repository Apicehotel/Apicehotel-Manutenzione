import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableStatus, RandDurableRuntime } from '../src/randai/core/durable-runtime.js'
const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']}

test('workflow version mismatch fails closed',async()=>{
 const runtime=new RandDurableRuntime();const v1={id:'flow',version:'1',execute:async()=>({wait:true,checkpoint:{x:1}})}
 const waiting=await runtime.start({workflow:v1,context,idempotencyKey:'version'})
 const v2={id:'flow',version:'2',execute:async()=>({output:'bad'})}
 const result=await runtime.resume({runId:waiting.id,workflow:v2,context})
 assert.equal(result.status,DurableStatus.FAILED);assert.equal(result.errorCode,'WORKFLOW_VERSION_MISMATCH')
})

test('cancel is terminal and prevents later execution',async()=>{
 let calls=0;const runtime=new RandDurableRuntime();const workflow={id:'cancel',version:'1',execute:async()=>{calls+=1;return {wait:true}}}
 const waiting=await runtime.start({workflow,context,idempotencyKey:'cancel'})
 const cancelled=await runtime.cancel(waiting.id);assert.equal(cancelled.status,DurableStatus.CANCELLED)
 const again=await runtime.resume({runId:waiting.id,workflow,context});assert.equal(again.status,DurableStatus.CANCELLED);assert.equal(calls,1)
})
