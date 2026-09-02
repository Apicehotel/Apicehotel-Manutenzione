import test from 'node:test'
import assert from 'node:assert/strict'

import { validateExecutionPlan } from '../src/reliability/plan-validator.js'
import { decideExecutionPolicy } from '../src/reliability/execution-policy.js'
import { RecoveryBudget, RecoveryCircuit, RecoveryCircuitState, authorizeRecoveryAttempt } from '../src/reliability/recovery-circuit.js'
import { FailureIntelligence, classifyRootCause } from '../src/reliability/failure-intelligence.js'
import { evaluateOperationalConfidence } from '../src/reliability/confidence-risk.js'

test('39 plan validator composes runtime validation and checks operational readiness', () => {
  const plan = {
    id: 'p1',
    steps: [
      { id: 's1', title: 'update issue', hotelId: 'hotel-gio', strategies: [{ toolId: 'issues.update' }], permission: 'issues.write', risk: 'medium', requires: ['issueLoaded'] },
    ],
  }
  assert.equal(validateExecutionPlan({ plan, hotelId: 'hotel-gio', availableTools: ['issues.update'], permissions: ['issues.write'], prerequisites: { issueLoaded: true } }).ok, true)
  const wrongHotel = validateExecutionPlan({ plan, hotelId: 'chocohotel', availableTools: ['issues.update'], permissions: ['issues.write'], prerequisites: { issueLoaded: true } })
  assert.equal(wrongHotel.ok, false)
  assert.equal(wrongHotel.issues[0].code, 'HOTEL_SCOPE_MISMATCH')
})

test('39 plan validator rejects unavailable tools and missing prerequisites before execution', () => {
  const plan = { id: 'p2', steps: [{ id: 's1', title: 'consume stock', strategies: [{ toolId: 'stock.consume' }], requires: ['stockAvailable'] }] }
  const result = validateExecutionPlan({ plan, hotelId: 'hotel-gio', availableTools: [], prerequisites: {} })
  assert.deepEqual(result.issues.map((i) => i.code).sort(), ['PREREQUISITE_MISSING', 'TOOL_UNAVAILABLE'])
})

test('40 execution policy consumes canonical confidence disposition', () => {
  const confidence = evaluateOperationalConfidence({ verification: 1, evidenceTrust: 1, contextCompleteness: 1, actionRisk: 0.1 })
  assert.equal(confidence.disposition, 'AUTO')
  assert.equal(decideExecutionPolicy({ hotelId: 'hotel-gio', planValidation: { ok: true }, confidenceDecision: confidence, permissionGranted: true }).decision, 'AUTO')
  assert.equal(decideExecutionPolicy({ hotelId: 'hotel-gio', planValidation: { ok: true }, confidenceDecision: confidence, permissionGranted: false }).decision, 'BLOCK')
})

test('40 REVIEW requires explicit approval and BLOCK never executes', () => {
  const review = { disposition: 'REVIEW' }
  assert.equal(decideExecutionPolicy({ hotelId: 'hotel-gio', planValidation: { ok: true }, confidenceDecision: review, permissionGranted: true }).decision, 'REVIEW')
  assert.equal(decideExecutionPolicy({ hotelId: 'hotel-gio', planValidation: { ok: true }, confidenceDecision: review, permissionGranted: true, approvalPresent: true }).decision, 'AUTO')
  assert.equal(decideExecutionPolicy({ hotelId: 'hotel-gio', planValidation: { ok: true }, confidenceDecision: { disposition: 'BLOCK' }, permissionGranted: true, approvalPresent: true }).decision, 'BLOCK')
})

test('41 recovery budget bounds attempts, elapsed time and cost', () => {
  const budget = new RecoveryBudget({ maxAttempts: 2, maxElapsedMs: 100, maxCostUnits: 3, startedAt: 1000 })
  assert.equal(budget.spend({ costUnits: 1, now: 1010 }).allowed, true)
  assert.equal(budget.spend({ costUnits: 1, now: 1020 }).allowed, true)
  assert.equal(budget.spend({ costUnits: 0, now: 1030 }).reason, 'ATTEMPT_BUDGET_EXHAUSTED')
  const timed = new RecoveryBudget({ maxAttempts: 3, maxElapsedMs: 10, maxCostUnits: 5, startedAt: 1000 })
  assert.equal(timed.spend({ now: 1011 }).reason, 'TIME_BUDGET_EXHAUSTED')
  const costly = new RecoveryBudget({ maxAttempts: 3, maxElapsedMs: 100, maxCostUnits: 1, startedAt: 1000 })
  assert.equal(costly.spend({ costUnits: 2, now: 1001 }).reason, 'COST_BUDGET_EXHAUSTED')
})

test('41 circuit breaker opens, cools down, probes half-open and closes on success', () => {
  const circuit = new RecoveryCircuit({ maxFailures: 2, cooldownMs: 50 })
  assert.equal(circuit.beforeAttempt(1000).allowed, true)
  circuit.recordFailure(1000)
  circuit.recordFailure(1010)
  assert.equal(circuit.snapshot().state, RecoveryCircuitState.OPEN)
  assert.equal(circuit.beforeAttempt(1040).reason, 'CIRCUIT_OPEN')
  assert.equal(circuit.beforeAttempt(1061).state, RecoveryCircuitState.HALF_OPEN)
  assert.equal(circuit.beforeAttempt(1062).reason, 'HALF_OPEN_PROBE_IN_FLIGHT')
  circuit.recordSuccess()
  assert.equal(circuit.snapshot().state, RecoveryCircuitState.CLOSED)
})

test('41 recovery authorization requires both circuit and budget', () => {
  const budget = new RecoveryBudget({ maxAttempts: 1, maxElapsedMs: 100, maxCostUnits: 2, startedAt: 1000 })
  const circuit = new RecoveryCircuit({ maxFailures: 2, cooldownMs: 10 })
  assert.equal(authorizeRecoveryAttempt({ budget, circuit, costUnits: 1, now: 1001 }).allowed, true)
  assert.equal(authorizeRecoveryAttempt({ budget, circuit, costUnits: 0, now: 1002 }).reason, 'ATTEMPT_BUDGET_EXHAUSTED')
})

test('42 failure intelligence groups failures by hotel and exposes recurring root cause', () => {
  const intelligence = new FailureIntelligence()
  intelligence.ingest({ hotelId: 'hotel-gio', component: 'action-gateway', operation: 'issue.update', resourceType: 'issue', code: 'revision_conflict', recovery: { action: 'READ_REPLAN', ok: true }, at: '2026-09-03T00:00:00Z' })
  intelligence.ingest({ hotelId: 'hotel-gio', component: 'action-gateway', operation: 'issue.update', resourceType: 'issue', code: 'revision_conflict', recovery: { action: 'READ_REPLAN', ok: true }, at: '2026-09-03T00:01:00Z' })
  intelligence.ingest({ hotelId: 'chocohotel', component: 'action-gateway', operation: 'issue.update', resourceType: 'issue', code: 'revision_conflict', at: '2026-09-03T00:02:00Z' })
  const gio = intelligence.list({ hotelId: 'hotel-gio' })
  assert.equal(gio.length, 1)
  assert.equal(gio[0].count, 2)
  assert.equal(gio[0].recurring, true)
  assert.equal(gio[0].rootCause, 'CONCURRENCY')
  assert.equal(gio[0].bestRecovery, 'READ_REPLAN')
  assert.equal(intelligence.list({ hotelId: 'chocohotel' })[0].count, 1)
})

test('42 root cause classification is deterministic', () => {
  assert.equal(classifyRootCause('permission_denied'), 'PERMISSION')
  assert.equal(classifyRootCause('timeout'), 'NETWORK')
  assert.equal(classifyRootCause('validation_failed'), 'VALIDATION')
  assert.equal(classifyRootCause('mystery'), 'UNKNOWN')
})
