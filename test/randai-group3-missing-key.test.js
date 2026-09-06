import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('durable workflow cannot start without idempotency key',async()=>{
 const runtime=new RandDurableRuntime();const workflow={id:'key',execute:async()=>({output:'x'})};const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']}
 await assert.rejects(()=>runtime.start({workflow,context}),/Idempotency key/)
})
