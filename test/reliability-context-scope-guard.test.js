import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ScopeDecision,
  ScopeReason,
  assertContextScope,
  evaluateContextScope,
} from '../src/reliability/context-scope-guard.js'

const context = {
  hotelId: 'hotelgio',
  actor: { userId: 'user-1', role: 'manutentore' },
  screen: { view: 'issues' },
  resource: { type: 'issue', id: '42' },
}

const reasonCodes = (result) => result.reasons.map((item) => item.reason)

test('allows a complete matching operational scope', () => {
  const result = evaluateContextScope({
    expected: { hotelId: 'hotelgio', userId: 'user-1', module: 'issues', recordType: 'issue', recordId: '42' },
    context,
    record: { id: '42', hotel_id: 'hotelgio', created_by: 'user-1' },
    permissionAllowed: true,
    requireActor: true,
    requireResource: true,
    ownership: { required: true },
  })
  assert.equal(result.decision, ScopeDecision.ALLOW)
  assert.equal(result.ok, true)
})

test('deny by default when operational context is missing', () => {
  const result = evaluateContextScope({ expected: { hotelId: 'hotelgio', module: 'issues' }, context: null })
  assert.equal(result.decision, ScopeDecision.BLOCK)
  assert.ok(reasonCodes(result).includes(ScopeReason.MISSING_CONTEXT))
})

test('blocks cross-hotel context and cross-hotel record', () => {
  const result = evaluateContextScope({
    expected: { hotelId: 'hotelgio', module: 'issues', recordId: '42' },
    context: { ...context, hotelId: 'chocohotel' },
    record: { id: '42', hotel_id: 'brigantino' },
  })
  assert.equal(result.ok, false)
  assert.ok(reasonCodes(result).includes(ScopeReason.HOTEL_MISMATCH))
})

test('blocks a different resource even inside the same hotel', () => {
  const result = evaluateContextScope({
    expected: { hotelId: 'hotelgio', module: 'issues', recordType: 'issue', recordId: '42' },
    context: { ...context, resource: { type: 'issue', id: '99' } },
    requireResource: true,
  })
  assert.ok(reasonCodes(result).includes(ScopeReason.RESOURCE_MISMATCH))
})

test('blocks actor mismatch and denied permission', () => {
  const result = evaluateContextScope({
    expected: { hotelId: 'hotelgio', userId: 'user-2', module: 'issues' },
    context,
    permissionAllowed: false,
    requireActor: true,
  })
  assert.ok(reasonCodes(result).includes(ScopeReason.ACTOR_MISMATCH))
  assert.ok(reasonCodes(result).includes(ScopeReason.PERMISSION_DENIED))
})

test('ownership is enforced unless an explicit privileged bypass is supplied', () => {
  const blocked = evaluateContextScope({
    expected: { hotelId: 'hotelgio', userId: 'user-1', module: 'issues' },
    context,
    record: { created_by: 'user-2' },
    ownership: { required: true },
  })
  assert.ok(reasonCodes(blocked).includes(ScopeReason.OWNERSHIP_MISMATCH))

  const privileged = evaluateContextScope({
    expected: { hotelId: 'hotelgio', userId: 'user-1', module: 'issues' },
    context,
    record: { created_by: 'user-2' },
    ownership: { required: true, bypass: true },
  })
  assert.equal(privileged.ok, true)
})

test('assert helper throws a stable guard error', () => {
  assert.throws(
    () => assertContextScope({ expected: { hotelId: 'hotelgio', module: 'issues', recordId: '42' }, context: null }),
    (error) => error?.code === 'SCOPE_GUARD_BLOCKED' && Array.isArray(error.reasons),
  )
})
