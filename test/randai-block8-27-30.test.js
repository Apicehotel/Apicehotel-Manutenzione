import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { createIssueContextEnvelope } from '../src/randai/context/envelope.js'
import { evaluateContextScope, ScopeReason } from '../src/reliability/context-scope-guard.js'
import { sanitizeOperationalContext } from '../supabase/functions/_shared/randai-operational-context.js'
import { stableJson } from '../supabase/functions/_shared/stable-json.js'

const gatewayClient = fs.readFileSync(new URL('../src/randai/action-gateway.js', import.meta.url), 'utf8')
const gatewayEdge = fs.readFileSync(new URL('../supabase/functions/randai-action-gateway/index.ts', import.meta.url), 'utf8')

test('27 operational context remains hotel scoped, versioned and stripped to supported evidence', () => {
  const envelope = createIssueContextEnvelope({
    hotelId: 'hotelgio',
    actor: { userId: 'u1', role: 'Manutentore' },
    issue: { id: 'i1', room: '1114', category: 'HVAC', title: 'Non raffredda', secret: 'no' },
  })
  const safe = sanitizeOperationalContext(envelope, 'hotelgio')
  assert.equal(safe.version, 1)
  assert.equal(safe.source, 'randapp')
  assert.equal(safe.hotelId, 'hotelgio')
  assert.equal(safe.resource.id, 'i1')
  assert.equal('secret' in safe.resource, false)
  assert.equal('actor' in safe, false, 'server context must not trust client actor identity')
})

test('27 operational context rejects unsupported versions and sources', () => {
  assert.throws(
    () => sanitizeOperationalContext({ version: 2, source: 'randapp', hotelId: 'hotelgio' }, 'hotelgio'),
    (error) => error?.code === 'CONTEXT_VERSION_UNSUPPORTED',
  )
  assert.throws(
    () => sanitizeOperationalContext({ version: 1, source: 'external', hotelId: 'hotelgio' }, 'hotelgio'),
    (error) => error?.code === 'CONTEXT_SOURCE_MISMATCH',
  )
})

test('28 scope guard fails closed when operational module/source/version are missing or wrong', () => {
  const expected = {
    hotelId: 'hotelgio', module: 'issues', recordType: 'issue', recordId: 'i1', source: 'randapp', version: 1,
  }
  const missingModule = evaluateContextScope({
    expected,
    context: { version: 1, source: 'randapp', hotelId: 'hotelgio', resource: { type: 'issue', id: 'i1' } },
    requireModule: true,
    requireResource: true,
  })
  assert.equal(missingModule.ok, false)
  assert.equal(missingModule.reasons.some((item) => item.reason === ScopeReason.MISSING_CONTEXT), true)

  const wrongSource = evaluateContextScope({
    expected,
    context: { version: 1, source: 'external', hotelId: 'hotelgio', screen: { view: 'issues' }, resource: { type: 'issue', id: 'i1' } },
    requireModule: true,
    requireResource: true,
  })
  assert.equal(wrongSource.ok, false)
  assert.equal(wrongSource.reasons.some((item) => item.reason === ScopeReason.SOURCE_MISMATCH), true)
})

test('29 action gateway client uses shared validation and full context guard before invoking Supabase', () => {
  assert.match(gatewayClient, /OperationValidationError/)
  assert.match(gatewayClient, /combineValidation/)
  assert.match(gatewayClient, /requireResource: true/)
  assert.match(gatewayClient, /requireModule: true/)
  assert.match(gatewayClient, /source: 'randapp'/)
  assert.match(gatewayClient, /version: 1/)
})

test('30 edge action gateway requires exact context and never accepts missing context', () => {
  assert.match(gatewayEdge, /if \(!context \|\| typeof context !== "object"\) return false/)
  assert.match(gatewayEdge, /contextSource === "randapp"/)
  assert.match(gatewayEdge, /contextVersion === 1/)
  assert.match(gatewayEdge, /contextModule === "issues"/)
  assert.match(gatewayEdge, /contextResourceType === "issue"/)
  assert.match(gatewayEdge, /contextResource === resourceId/)
})

test('30 idempotency identity is canonical across object key order', () => {
  const a = stableJson({ input: { note: 'x', status: 'done' }, hotelId: 'hotelgio' })
  const b = stableJson({ hotelId: 'hotelgio', input: { status: 'done', note: 'x' } })
  assert.equal(a, b)
  assert.match(gatewayEdge, /const identityMaterial = stableJson\(/)
})

test('30 verified executions and durable replays return an operational receipt', () => {
  assert.match(gatewayEdge, /function receipt\(/)
  assert.match(gatewayEdge, /idempotency_key:/)
  assert.match(gatewayEdge, /audit_recorded:/)
  assert.match(gatewayEdge, /receipt: receipt\(/)
  assert.match(gatewayEdge, /verified: true/)
})
