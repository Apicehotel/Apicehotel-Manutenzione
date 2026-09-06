import test from 'node:test'
import assert from 'node:assert/strict'
import { planRecovery } from '../src/randai/recovery/engine.js'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('existing recovery engine and durable runtime remain separate live owners',()=>{
 assert.equal(typeof planRecovery,'function')
 assert.equal(typeof RandDurableRuntime,'function')
 const plan=planRecovery({hotelId:'gio',code:'timeout',permission:'READ'})
 assert.ok(plan.action)
})
