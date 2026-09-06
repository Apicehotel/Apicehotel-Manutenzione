import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('existing idempotent run is returned without re-executing',async()=>{
 let calls=0;const runtime=new RandDurableRuntime();const workflow={id:'idem',execute:async()=>{calls++;return {output:'ok'}}};const context={actor:{id:'u1'},hotelId:'gio',grantedScopes:['workflow:execute']}
 const a=await runtime.start({workflow,context,idempotencyKey:'gio:idem:1'});const b=await runtime.start({workflow,context,idempotencyKey:'gio:idem:1'});assert.equal(a.id,b.id);assert.equal(calls,1)
})
