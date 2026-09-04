import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAIVerifier } from '../src/randai/runtime/verifier.js'

const success = { status: 'SUCCESS', metadata: {} }
const independentPass = { id: 'readback', score: 1, passed: true, independent: true }

test('runtime verification remains backward compatible when no gate is requested', async () => {
  const result = await new RandAIVerifier().verify({
    task: { metadata: { hotelId: 'hotelgio' } },
    step: { id: 'read' },
    strategy: { toolId: 'read' },
    result: success,
  })

  assert.deepEqual(result, { ok: true, reason: 'tool_success' })
})

test('runtime verification accepts independently verified in-scope results', async () => {
  const result = await new RandAIVerifier().verify({
    task: { metadata: { hotelId: 'hotelgio' } },
    step: { id: 'read', verification: { gate: { checks: [independentPass] } } },
    strategy: { toolId: 'read' },
    result: success,
  })

  assert.equal(result.ok, true)
  assert.equal(result.gate.decision, 'PASS')
})

test('runtime verification rejects cross-hotel results', async () => {
  const result = await new RandAIVerifier().verify({
    task: { metadata: { hotelId: 'hotelgio' } },
    step: {
      id: 'read',
      targetHotelId: 'chocohotel',
      verification: { gate: { checks: [independentPass] } },
    },
    strategy: { toolId: 'read' },
    result: success,
  })

  assert.equal(result.ok, false)
  assert.equal(result.gate.decision, 'BLOCK')
  assert.deepEqual(result.gate.reasons, ['HOTEL_MISMATCH'])
})

test('runtime verification requires an independent check by default', async () => {
  const result = await new RandAIVerifier().verify({
    task: { metadata: { hotelId: 'hotelgio' } },
    step: {
      id: 'diagnose',
      verification: { gate: { checks: [{ id: 'model', score: 1, passed: true }] } },
    },
    strategy: { toolId: 'diagnose' },
    result: success,
  })

  assert.equal(result.ok, false)
  assert.equal(result.gate.decision, 'BLOCK')
  assert.ok(result.gate.reasons.includes('NO_INDEPENDENT_VERIFICATION'))
})
