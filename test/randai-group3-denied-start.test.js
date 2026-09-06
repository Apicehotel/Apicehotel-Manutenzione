import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('denied start never executes workflow',async()=>{
 let calls=0;const runtime=new RandDurableRuntime();const workflow={id:'denied',execute:async()=>{calls+=1}}
 const result=await runtime.start({workflow,context:{actor:{id:'u1'},hotelId:'gio',grantedScopes:[]},idempotencyKey:'denied'})
 assert.equal(result.status,'DENIED');assert.equal(result.authorization.code,'SCOPE_DENIED');assert.equal(calls,0)
})
