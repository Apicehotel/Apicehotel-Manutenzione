import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableStatus, RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('resume cannot substitute a different actor',async()=>{
 const runtime=new RandDurableRuntime();const workflow={id:'actor',execute:async()=>({wait:true})};const base={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']}
 const waiting=await runtime.start({workflow,context:base,idempotencyKey:'actor'})
 const result=await runtime.resume({runId:waiting.id,workflow,context:{...base,actor:{id:'u2'}}})
 assert.equal(result.status,DurableStatus.FAILED);assert.equal(result.errorCode,'REAUTHORIZATION_FAILED')
})
