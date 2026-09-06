import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('cross-hotel durable start fails before workflow execution',async()=>{
 let calls=0;const runtime=new RandDurableRuntime();const workflow={id:'hotel',execute:async()=>{calls++}}
 const result=await runtime.start({workflow,context:{actor:{id:'u1'},hotelId:'gio',targetHotelId:'choco',grantedScopes:['workflow:execute']},idempotencyKey:'cross'})
 assert.equal(result.status,'DENIED');assert.equal(result.authorization.code,'CROSS_HOTEL_DENIED');assert.equal(calls,0)
})
