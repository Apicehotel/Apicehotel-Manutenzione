import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('runtime rejects malformed workflows before persistence',async()=>{
 const runtime=new RandDurableRuntime();await assert.rejects(()=>runtime.start({workflow:{id:'bad'},idempotencyKey:'bad'}),/execute/)
})
