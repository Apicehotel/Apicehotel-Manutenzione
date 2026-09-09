import test from 'node:test'
import assert from 'node:assert/strict'
import { RAND_FLOW_STAGES, RandFlowStage, buildRandFlowPolicy, assertRandFlowReadyForHumanReview } from '../src/randai/core/rand-flow-policy.js'

test('RandFlow requires a dedicated branch and preserves human approval', () => {
  assert.throws(() => buildRandFlowPolicy({ branch: 'main' }), /forbids agent work directly/)
  const policy = buildRandFlowPolicy({ branch: 'randai/example' })
  assert.equal(policy.directMainPush, false)
  assert.equal(policy.automaticMerge, false)
  assert.equal(policy.humanApprovalRequired, true)
  assert.equal(policy.productionDeployBeforeApproval, false)
  assert.deepEqual(policy.stages, RAND_FLOW_STAGES)
})

test('RandFlow cannot claim completion without test, security and CI evidence', () => {
  const policy = buildRandFlowPolicy({ branch: 'randai/example' })
  assert.throws(() => assertRandFlowReadyForHumanReview({ policy, testsPassed: false, securityPassed: true, ciPassed: true }), /Tests must pass/)
  assert.throws(() => assertRandFlowReadyForHumanReview({ policy, testsPassed: true, securityPassed: false, ciPassed: true }), /Security gates must pass/)
  assert.throws(() => assertRandFlowReadyForHumanReview({ policy, testsPassed: true, securityPassed: true, ciPassed: false }), /CI must pass/)
  assert.throws(() => assertRandFlowReadyForHumanReview({ policy, testsPassed: true, securityPassed: true, ciPassed: true, unresolved: ['zombie'] }), /Unresolved work remains/)
})

test('RandFlow returns only ready-for-human-merge after all gates pass', () => {
  const policy = buildRandFlowPolicy({ branch: 'randai/example' })
  const result = assertRandFlowReadyForHumanReview({ policy, testsPassed: true, securityPassed: true, ciPassed: true, unresolved: [] })
  assert.equal(result.ready, true)
  assert.equal(result.stage, RandFlowStage.READY_FOR_HUMAN_MERGE)
  assert.equal(result.humanApprovalRequired, true)
})
