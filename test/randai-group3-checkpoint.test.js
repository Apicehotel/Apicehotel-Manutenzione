import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('checkpoint survives wait and is supplied on resume',async()=>{
 const runtime=new RandDurableRuntime();const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']};let seen=null
 const workflow={id:'checkpoint',execute:async({checkpoint})=>{if(!checkpoint)return {wait:true,checkpoint:{step:7}};seen=checkpoint;return {output:'ok'}}}
 const waiting=await runtime.start({workflow,context,idempotencyKey:'checkpoint'});await runtime.resume({runId:waiting.id,workflow,context});assert.deepEqual(seen,{step:7})
})
