import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('terminal idempotent result is stable',async()=>{
 const runtime=new RandDurableRuntime();const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']};let calls=0
 const workflow={id:'stable',execute:async()=>({output:++calls})};const first=await runtime.start({workflow,context,idempotencyKey:'stable'});const second=await runtime.start({workflow,context,idempotencyKey:'stable'})
 assert.equal(first.output,1);assert.equal(second.output,1);assert.equal(calls,1)
})
