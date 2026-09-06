import test from 'node:test'
import assert from 'node:assert/strict'
import { assertDurableStore } from '../src/randai/core/durable-store-contract.js'

test('durable store contract fails closed for incomplete persistence adapters', () => {
  assert.throws(() => assertDurableStore({ get(){}, put(){} }), /byKey/)
  const store = { get(){}, put(){}, byKey(){}, bindKey(){} }
  assert.equal(assertDurableStore(store), store)
})
