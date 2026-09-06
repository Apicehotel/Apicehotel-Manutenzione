import test from 'node:test'
import assert from 'node:assert/strict'
import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

test('cancelling an unknown run is harmless',async()=>{const runtime=new RandDurableRuntime();assert.equal(await runtime.cancel('missing'),null)})
