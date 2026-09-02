import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateVerificationGate,
  VerificationDecision,
  evaluateEvidenceTrust,
  buildHybridKnowledgeContext,
  evaluateOperationalConfidence,
  ActionDisposition,
} from '../src/reliability/index.js'

test('35 verification gate is hotel-scoped and requires independent verification', () => {
  const pass = evaluateVerificationGate({
    hotelId: 'hotelgio',
    checks: [
      { id: 'readback', hotelId: 'hotelgio', score: 1, passed: true, independent: true },
      { id: 'domain', hotelId: 'hotelgio', score: 0.9, passed: true },
    ],
  })
  assert.equal(pass.decision, VerificationDecision.PASS)
  assert.equal(evaluateVerificationGate({ hotelId: 'hotelgio', expectedHotelId: 'choco', checks: [{ id: 'x', score: 1, passed: true, independent: true }] }).decision, VerificationDecision.BLOCK)
  assert.equal(evaluateVerificationGate({ hotelId: 'hotelgio', checks: [{ id: 'x', score: 1, passed: true }] }).decision, VerificationDecision.BLOCK)
})

test('36 evidence trust rejects cross-hotel evidence and rewards corroboration', () => {
  const now = Date.parse('2026-09-03T00:00:00Z')
  const trusted = evaluateEvidenceTrust({
    hotelId: 'hotelgio', now,
    evidence: [
      { id: 'a', hotelId: 'hotelgio', tier: 'verified', at: '2026-09-02T23:00:00Z', source: { kind: 'procedure', id: 'p1' } },
      { id: 'b', hotelId: 'hotelgio', tier: 'approved', at: '2026-09-02T23:30:00Z', source: { kind: 'manual', id: 'm1' } },
    ],
  })
  assert.ok(trusted.trust > 0.8)
  assert.throws(() => evaluateEvidenceTrust({ hotelId: 'hotelgio', evidence: [{ id: 'x', hotelId: 'choco', tier: 'verified', at: new Date(now).toISOString(), source: { kind: 'manual', id: 'm2' } }] }), /EVIDENCE_HOTEL_MISMATCH/)
})

test('37 hybrid memory+graph never widens hotel scope', () => {
  const result = buildHybridKnowledgeContext({
    hotelId: 'hotelgio', minTrust: 0.7,
    memories: [
      { id: 'm1', hotelId: 'hotelgio', content: 'gio', trustScore: 0.9 },
      { id: 'm2', hotelId: 'choco', content: 'choco', trustScore: 1 },
    ],
    nodes: [
      { id: 'n1', hotelId: 'hotelgio', type: 'room', label: '1114' },
      { id: 'n2', hotelId: 'choco', type: 'room', label: '201' },
    ],
    edges: [
      { hotelId: 'hotelgio', from: 'n1', to: 'n1', type: 'related' },
      { hotelId: 'choco', from: 'n2', to: 'n2', type: 'related' },
    ],
  })
  assert.deepEqual(result.context.map((x) => x.id).sort(), ['m1', 'n1'])
  assert.equal(result.edges.length, 1)
})

test('38 confidence/risk engine never auto-executes critical or high-risk actions', () => {
  const safe = evaluateOperationalConfidence({ verification: 1, evidenceTrust: 0.95, contextCompleteness: 1, actionRisk: 0.1 })
  assert.equal(safe.disposition, ActionDisposition.AUTO)
  const critical = evaluateOperationalConfidence({ verification: 1, evidenceTrust: 1, contextCompleteness: 1, actionRisk: 0.1, critical: true })
  assert.equal(critical.disposition, ActionDisposition.BLOCK)
  const risky = evaluateOperationalConfidence({ verification: 1, evidenceTrust: 1, contextCompleteness: 1, actionRisk: 0.9 })
  assert.equal(risky.disposition, ActionDisposition.BLOCK)
  assert.throws(() => evaluateOperationalConfidence({ verification: Number.NaN, evidenceTrust: 1, contextCompleteness: 1, actionRisk: 0 }), /verification/)
})
