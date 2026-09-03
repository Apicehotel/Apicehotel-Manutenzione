import test from 'node:test'
import assert from 'node:assert/strict'
import { FaultMode, createFaultInjector, scriptedFaults } from '../src/reliability/fault-injection.js'
import { runAdversarialSuite, assertAdversarialSuite } from '../src/reliability/adversarial-suite.js'
import { evaluateReleaseGate } from '../src/reliability/release-gate.js'
import { SafeRolloutController, RolloutState } from '../src/reliability/rollout-controller.js'
import { reconcileAmbiguousWrite, AmbiguousWriteDecision, withOfflineLease } from '../src/reliability/offline-concurrency.js'
import { RecoveryCircuit, RecoveryCircuitState } from '../src/reliability/recovery-circuit.js'

test('43 adversarial suite is hotel-scoped and fail-closed', async () => {
  const result = await runAdversarialSuite({ hotelId: 'gio', scenarios: [
    { id: 'timeout-after-write', hotelId: 'gio', run: async () => 'reconciled', assert: (v) => v === 'reconciled' },
    { id: 'cross-hotel-deny', hotelId: 'gio', run: async () => true, assert: Boolean },
  ] })
  assert.equal(result.ok, true)
  assert.equal(assertAdversarialSuite(result).passed, 2)
  await assert.rejects(() => runAdversarialSuite({ hotelId: 'gio', scenarios: [{ id: 'bad', hotelId: 'choco', run: async()=>true, assert:()=>true }] }), /HOTEL_SCOPE_MISMATCH/)
})

test('44 fault injection reproduces write-then-timeout and recovery reconciliation', async () => {
  let applied = false
  const inject = createFaultInjector({ mode: FaultMode.THROW_AFTER, code: 'NETWORK_ERROR' })
  await assert.rejects(() => inject(async () => { applied = true; return { ok: true } }), (error) => error.code === 'NETWORK_ERROR')
  assert.equal(applied, true)
  const decision = await reconcileAmbiguousWrite({
    idempotencyKey: 'idem-1', findReceipt: async () => null, readBack: async () => ({ applied }), matchesExpected: async (current) => current.applied === true,
  })
  assert.equal(decision.decision, AmbiguousWriteDecision.CONFIRMED_APPLIED)

  const sequence = scriptedFaults([{ mode: FaultMode.THROW_BEFORE, code: 'RATE_LIMIT' }, { mode: FaultMode.NONE }])
  await assert.rejects(() => sequence(async () => 'ok'), (error) => error.code === 'RATE_LIMIT')
  assert.equal(await sequence(async () => 'ok'), 'ok')
})

test('44 lease and circuit breaker withstand adversarial timing', () => {
  const now = 1000
  const op = { operationId:'op', idempotencyKey:'key', leaseOwner:'worker-a', leaseUntil:now+5000, nextAttemptAt:0 }
  assert.equal(withOfflineLease(op, 'worker-b', now), null)
  const circuit = new RecoveryCircuit({ maxFailures: 2, cooldownMs: 100 })
  circuit.recordFailure(now); circuit.recordFailure(now)
  assert.equal(circuit.snapshot().state, RecoveryCircuitState.OPEN)
  assert.equal(circuit.beforeAttempt(now + 50).allowed, false)
  assert.equal(circuit.beforeAttempt(now + 101).state, RecoveryCircuitState.HALF_OPEN)
  assert.equal(circuit.beforeAttempt(now + 102).allowed, false)
})

test('45 release gate blocks missing checks and metric regressions', () => {
  const greenChecks = { security:true, quality:true, critical:true, multihotel:true, build:true, contracts:true, browser:true, device:true, adversarial:true }
  assert.equal(evaluateReleaseGate({ checks: greenChecks }).ok, true)
  assert.equal(evaluateReleaseGate({ checks: { ...greenChecks, adversarial:false } }).ok, false)
  const regression = evaluateReleaseGate({ checks: greenChecks, metrics: { failureRate:0.03 } })
  assert.equal(regression.ok, false)
  assert.equal(regression.failures.some((f) => f.code === 'FAILURE_RATE_REGRESSION'), true)
})

test('46 rollout is deterministic, hotel/module scoped and automatically rolls back', () => {
  const rollout = new SafeRolloutController({ rolloutId:'r1', percentage:100, hotelIds:['gio'], module:'issues', maxFailureRate:0.02 })
  assert.equal(rollout.eligible({ hotelId:'gio', actorId:'u1', module:'issues' }), true)
  assert.equal(rollout.eligible({ hotelId:'choco', actorId:'u1', module:'issues' }), false)
  assert.equal(rollout.eligible({ hotelId:'gio', actorId:'u1', module:'warehouse' }), false)
  rollout.evaluateHealth({ failureRate:0.03, verificationFailureRate:0 })
  assert.equal(rollout.snapshot().state, RolloutState.ROLLED_BACK)
  assert.equal(rollout.eligible({ hotelId:'gio', actorId:'u1', module:'issues' }), false)
})
