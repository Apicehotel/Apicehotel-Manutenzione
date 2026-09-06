import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('fresh knowledge is resolved before workflow body on every execution',async()=>{
 const events=[];const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']}
 const runtime=new RandDurableRuntime({refreshKnowledge:async()=>{events.push('knowledge');return {fresh:true}}})
 const workflow={id:'order',version:'1',execute:async({knowledge})=>{events.push('execute');assert.equal(knowledge.fresh,true);return {output:'ok'}}}
 await runtime.start({workflow,context,idempotencyKey:'order'})
 assert.deepEqual(events,['knowledge','execute'])
})
