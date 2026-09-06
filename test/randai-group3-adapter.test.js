import test from 'node:test'
import assert from 'node:assert/strict'
import { createDurableExecutorAdapter, DurableExecutor } from '../src/randai/core/durable-adapters.js'

test('Rand is default durable executor contract without external dependency', () => {
  const adapter = createDurableExecutorAdapter({})
  assert.equal(adapter.name, DurableExecutor.RAND)
  assert.equal(adapter.external, false)
})

test('Trigger.dev remains an explicit external adapter and cannot be enabled without enqueue', () => {
  assert.throws(() => createDurableExecutorAdapter({ name: DurableExecutor.TRIGGER_DEV }), /enqueue/)
  const adapter = createDurableExecutorAdapter({ name: DurableExecutor.TRIGGER_DEV, enqueue: async () => 'job' })
  assert.equal(adapter.external, true)
})
