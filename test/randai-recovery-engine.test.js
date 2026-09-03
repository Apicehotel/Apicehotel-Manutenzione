import test from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryBudget, RecoveryCircuit } from '../src/reliability/recovery-circuit.js'
import { FailureIntelligence } from '../src/reliability/failure-intelligence.js'
import { RecoveryAction, RecoveryDisposition, executeRecovery, planRecovery } from '../src/randai/recovery/engine.js'

test('recovery plans transient network failures and stops unsafe writes', () => {
  assert.equal(planRecovery({ hotelId: 'gio', code: 'timeout', permission: 'READ' }).action, RecoveryAction.RETRY_READ)
  assert.equal(planRecovery({ hotelId: 'gio', code: 'timeout', permission: 'WRITE', idempotent: false }).disposition, RecoveryDisposition.REVIEW)
  assert.equal(planRecovery({ hotelId: 'gio', code: 'verification_failed' }).disposition, RecoveryDisposition.REVIEW)
})

test('recovery uses budget, circuit and verification before declaring success', async () => {
  const budget = new RecoveryBudget({ maxAttempts: 2, maxElapsedMs: 1000, maxCostUnits: 5 })
  const circuit = new RecoveryCircuit({ maxFailures: 2, cooldownMs: 1000 })
  const intelligence = new FailureIntelligence()
  const result = await executeRecovery({
    failure: { hotelId: 'gio', component: 'gateway', operation: 'read', resourceType: 'issue', code: 'timeout', permission: 'READ', idempotent: true },
    budget,
    circuit,
    handlers: { [RecoveryAction.RETRY_READ]: async () => ({ ok: true, value: 'fresh' }) },
    verify: async ({ output }) => output.value === 'fresh',
    failureIntelligence: intelligence,
  })
  assert.equal(result.status, 'RECOVERED')
  assert.equal(result.budget.attempts, 1)
  assert.equal(result.circuit.state, 'CLOSED')
  assert.equal(intelligence.describe('gio|gateway|read|issue|timeout').bestRecovery, RecoveryAction.RETRY_READ)
})

test('recovery fails closed when the circuit is open or handler is missing', async () => {
  const budget = new RecoveryBudget({ maxAttempts: 1 })
  const circuit = new RecoveryCircuit({ maxFailures: 1 })
  circuit.recordFailure()
  const open = await executeRecovery({
    failure: { hotelId: 'gio', code: 'timeout', permission: 'READ', idempotent: true },
    budget,
    circuit,
  })
  assert.equal(open.status, 'STOPPED')

  const freshCircuit = new RecoveryCircuit()
  const missing = await executeRecovery({
    failure: { hotelId: 'gio', code: 'timeout', permission: 'READ', idempotent: true },
    budget: new RecoveryBudget(),
    circuit: freshCircuit,
  })
  assert.equal(missing.status, 'NEEDS_REVIEW')
})

test('recovery never retries an unknown or non-idempotent failure', () => {
  const unknown = planRecovery({ hotelId: 'choco', code: 'weird_failure', permission: 'READ' })
  const conflict = planRecovery({ hotelId: 'choco', code: 'conflict', permission: 'WRITE', idempotent: false, reversible: false })
  assert.equal(unknown.disposition, RecoveryDisposition.REVIEW)
  assert.equal(conflict.disposition, RecoveryDisposition.REVIEW)
})
