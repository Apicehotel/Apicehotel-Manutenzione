import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('maxAttempts cannot be configured below one',async()=>{
 const runtime=new RandDurableRuntime();const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']};const workflow={id:'attempt',execute:async()=>({output:'ok'})};const run=await runtime.start({workflow,context,idempotencyKey:'attempt',maxAttempts:0});assert.equal(run.maxAttempts,3)
})
