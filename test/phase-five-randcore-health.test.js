import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMonthlyHealthCadence, healthCadenceLabel, HealthCadenceState } from '../src/randai/core/health-cadence.js'

const now = new Date('2026-09-15T00:00:00Z')

test('monthly health cadence is fresh, due soon, overdue, or missing', () => {
  assert.equal(evaluateMonthlyHealthCadence({ created_at: '2026-09-01T00:00:00Z' }, { now }).state, HealthCadenceState.FRESH)
  const due = evaluateMonthlyHealthCadence({ created_at: '2026-08-14T00:00:00Z' }, { now })
  assert.equal(due.state, HealthCadenceState.DUE_SOON)
  assert.match(healthCadenceLabel(due), /In scadenza/)
  const overdue = evaluateMonthlyHealthCadence({ created_at: '2026-08-01T00:00:00Z' }, { now })
  assert.equal(overdue.state, HealthCadenceState.OVERDUE)
  assert.equal(overdue.overdueDays, 10)
  assert.equal(evaluateMonthlyHealthCadence(null, { now }).state, HealthCadenceState.MISSING)
})

test('invalid timestamps fail closed as missing', () => {
  const result = evaluateMonthlyHealthCadence({ created_at: 'not-a-date' }, { now })
  assert.equal(result.state, HealthCadenceState.MISSING)
  assert.equal(healthCadenceLabel(result), 'Mai eseguito')
})
