import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableStatus, RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('waiting is non-terminal and resumable',async()=>{
 let step=0;const runtime=new RandDurableRuntime();const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']};const workflow={id:'wait',execute:async()=>++step===1?{wait:true}:{output:'done'}}
 const waiting=await runtime.start({workflow,context,idempotencyKey:'wait'});assert.equal(waiting.status,DurableStatus.WAITING);const done=await runtime.resume({runId:waiting.id,workflow,context});assert.equal(done.status,DurableStatus.SUCCEEDED)
})
