import test from 'node:test'
import assert from 'node:assert/strict'
import * as core from '../src/randai/core/index.js'

test('durable contracts are exported by canonical RandAI core',()=>{
 assert.equal(typeof core.RandDurableRuntime,'function');assert.equal(typeof core.createDurableExecutorAdapter,'function');assert.equal(typeof core.assertDurableStore,'function')
})
