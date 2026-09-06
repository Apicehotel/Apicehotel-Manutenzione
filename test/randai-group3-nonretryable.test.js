import test from 'node:test'
import assert from 'node:assert/strict'
import { DurableStatus, RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('non retryable errors fail immediately',async()=>{
 const runtime=new RandDurableRuntime();const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']};let calls=0
 const workflow={id:'fatal',execute:async()=>{calls++;throw Object.assign(new Error('fatal'),{code:'FATAL'})}}
 const result=await runtime.start({workflow,context,idempotencyKey:'fatal',maxAttempts:5});assert.equal(result.status,DurableStatus.FAILED);assert.equal(result.errorCode,'FATAL');assert.equal(calls,1)
})
