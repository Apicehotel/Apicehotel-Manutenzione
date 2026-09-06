import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('durable run persists workflow, hotel, actor and bounded attempt metadata',async()=>{
 const runtime=new RandDurableRuntime();const workflow={id:'shape',version:'3',execute:async()=>({output:'ok'})};const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']};const run=await runtime.start({workflow,context,idempotencyKey:'shape',maxAttempts:4})
 assert.equal(run.workflowId,'shape');assert.equal(run.workflowVersion,'3');assert.equal(run.hotelId,'gio');assert.equal(run.actorId,'u1');assert.equal(run.maxAttempts,4);assert.equal(run.attempt,1)
})
