import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAIControlCenter } from '../src/randai/control-center/engine.js'

class Store {
  constructor(items=[]){ this.items=items }
  async list(){ return structuredClone(this.items) }
}
class FailingStore {
  async list(){ throw new Error('source offline') }
}

test('control center reports partial source failure without losing healthy projections', async () => {
  const center = new RandAIControlCenter({
    taskStore: new Store([{ id:'T1', hotelId:'gio', status:'RUNNING', objective:'Check pump' }]),
    signalStore: new FailingStore(),
  })
  const snapshot = await center.snapshot({ projectId:'randai', hotelId:'gio' })
  assert.equal(snapshot.health.status, 'DEGRADED')
  assert.equal(snapshot.health.sources.tasks.status, 'READY')
  assert.equal(snapshot.health.sources.signals.status, 'ERROR')
  assert.equal(snapshot.health.sources.signals.error, 'source offline')
  assert.equal(snapshot.counts.ACTIVE, 1)
})

test('unconfigured sources are explicit and all-hotel scope remains opt-in', async () => {
  const center = new RandAIControlCenter()
  const snapshot = await center.snapshot({ projectId:'randai', allHotels:true })
  assert.equal(snapshot.health.status, 'NO_DATA')
  assert.equal(snapshot.health.sources.tasks.status, 'NOT_CONFIGURED')
  await assert.rejects(() => center.snapshot({ projectId:'randai' }), /hotelId or explicit allHotels/)
})
