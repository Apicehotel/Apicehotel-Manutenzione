import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolPermission, ToolRisk } from '../src/randai/tools/contracts.js'
import { AutonomyDecision, AutonomyLevel } from '../src/randai/autonomy/contracts.js'
import { resolveAutonomyDecision } from '../src/randai/autonomy/decision.js'

const base = {
  evaluation: {
    decision: AutonomyDecision.ALLOW,
    reason: 'L3_SAFE_ACTION',
    tool: { permission: ToolPermission.READ, risk: ToolRisk.LOW },
  },
  confidenceDecision: { disposition: 'AUTO' },
  planValidation: { ok: true },
  permissionGranted: true,
  contextValid: true,
}

test('autonomy 2.0 auto-allows only a safe, verified action', () => {
  const result = resolveAutonomyDecision(base)
  assert.equal(result.disposition, 'AUTO')
  assert.equal(result.allowed, true)
})

test('review confidence and protected actions require confirmation', () => {
  const review = resolveAutonomyDecision({ ...base, confidenceDecision: { disposition: 'REVIEW' } })
  const protectedAction = resolveAutonomyDecision({
    ...base,
    evaluation: { ...base.evaluation, tool: { permission: ToolPermission.WRITE_PROTECTED, risk: ToolRisk.MEDIUM } },
  })
  assert.equal(review.disposition, 'CONFIRM')
  assert.equal(protectedAction.disposition, 'CONFIRM')
  assert.equal(resolveAutonomyDecision({ ...protectedAction, humanConfirmed: true }).disposition, 'AUTO')
})

test('critical, invalid, denied and unscoped actions fail closed', () => {
  for (const patch of [
    { evaluation: { ...base.evaluation, tool: { permission: ToolPermission.WRITE, risk: ToolRisk.CRITICAL } } },
    { planValidation: { ok: false } },
    { evaluation: { ...base.evaluation, decision: AutonomyDecision.DENY } },
    { contextValid: false },
    { permissionGranted: false },
  ]) {
    assert.equal(resolveAutonomyDecision({ ...base, ...patch }).disposition, 'BLOCK')
  }
})

test('approval cannot be used to escalate autonomy', () => {
  const result = resolveAutonomyDecision({
    ...base,
    requestedLevel: AutonomyLevel.AUTONOMOUS,
    policyLevel: AutonomyLevel.EXECUTE_SAFE,
    humanConfirmed: true,
  })
  assert.equal(result.disposition, 'BLOCK')
  assert.equal(result.reason, 'AUTONOMY_ESCALATION_DENIED')
})
