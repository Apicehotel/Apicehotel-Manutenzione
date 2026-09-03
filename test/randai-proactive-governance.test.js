import test from 'node:test'
import assert from 'node:assert/strict'
import { ProactiveEngine } from '../src/randai/proactive/engine.js'
import { ProactiveSignalStore } from '../src/randai/proactive/store.js'
import { SignalStatus } from '../src/randai/proactive/contracts.js'

test('terminal proactive signals are idempotent and cannot be actioned twice', async () => {
  let calls = 0
  const engine = new ProactiveEngine({
    store: new ProactiveSignalStore(),
    supervisor: { run: async () => { calls += 1; return { id: 'SUP-1', status: 'SUCCEEDED' } } },
  })
  const signal = await engine.ingest({ hotelId: 'gio', type: 'HIGH_TEMP', fingerprint: 'temp:gio', severity: 'HIGH' })
  const first = await engine.process(signal.id, { hotelId: 'gio', executeSingle: async () => ({ ok: true }) })
  const second = await engine.process(signal.id, { hotelId: 'gio', executeSingle: async () => ({ ok: true }) })
  assert.equal(first.status, SignalStatus.ACTIONED)
  assert.equal(second.status, SignalStatus.ACTIONED)
  assert.equal(second.supervisorRunId, 'SUP-1')
  assert.equal(calls, 1)
})

test('terminal signal still requires its original hotel scope', async () => {
  const engine = new ProactiveEngine({ store: new ProactiveSignalStore() })
  const signal = await engine.ingest({ hotelId: 'choco', type: 'WEATHER', fingerprint: 'weather:choco', severity: 'LOW' })
  await engine.process(signal.id, { hotelId: 'choco' })
  await assert.rejects(() => engine.process(signal.id, { hotelId: 'gio' }), /hotel scope mismatch/)
})
