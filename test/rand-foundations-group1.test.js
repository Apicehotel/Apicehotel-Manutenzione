import test from 'node:test'
import assert from 'node:assert/strict'

import { AgentCapability, assertAgentPermission } from '../src/randai/core/agent-permission-gate.js'
import { RandFocusPhase, buildRandFocusStatus } from '../src/randai/core/rand-focus.js'
import { buildRandFlowPolicy } from '../src/randai/core/rand-flow-policy.js'

test('agent permission gate denies main mutations and production deploy', () => {
  assert.throws(() => assertAgentPermission({ actor: 'agent', capability: AgentCapability.WRITE, branch: 'main' }), /forbidden/)
  assert.throws(() => assertAgentPermission({ actor: 'agent', capability: AgentCapability.EXECUTE, branch: 'main' }), /forbidden/)
  assert.throws(() => assertAgentPermission({ actor: 'agent', capability: AgentCapability.DEPLOY, branch: 'feat/x', environment: 'production' }), /human-only/)
})

test('agent permission gate allows bounded work on a dedicated branch', () => {
  const read = assertAgentPermission({ actor: 'agent', capability: AgentCapability.READ })
  assert.equal(read.allowed, true)
  const write = assertAgentPermission({ actor: 'agent', capability: AgentCapability.WRITE, branch: 'feat/x' })
  assert.equal(write.allowed, true)
  assert.equal(write.branch, 'feat/x')
})

test('production deploy requires a human actor and explicit approval', () => {
  assert.throws(() => assertAgentPermission({ actor: 'human', capability: AgentCapability.DEPLOY, branch: 'release/x', environment: 'production' }), /explicit human approval/)
  const result = assertAgentPermission({ actor: 'human', capability: AgentCapability.DEPLOY, branch: 'release/x', environment: 'production', humanApproved: true })
  assert.equal(result.allowed, true)
  assert.equal(result.humanApprovalRequired, true)
})

test('RandFocus cannot claim DONE without complete evidence', () => {
  const common = { taskId: 'g1', title: 'Group 1', phase: RandFocusPhase.DONE, completed: 4, total: 4, securityPassed: true, ciPassed: true }
  assert.throws(() => buildRandFocusStatus({ ...common, testsPassed: false }), /tests pass/)
  assert.throws(() => buildRandFocusStatus({ ...common, testsPassed: true, remaining: ['review'] }), /unresolved work/)
})

test('RandFocus and RandFlow share evidence-before-completion semantics', () => {
  const policy = buildRandFlowPolicy({ branch: 'feat/rand-foundations-group1' })
  assert.equal(policy.evidenceBeforeCompletion, true)
  const status = buildRandFocusStatus({
    taskId: 'g1', title: 'Group 1', phase: RandFocusPhase.DONE,
    completed: 4, total: 4, testsPassed: true, securityPassed: true, ciPassed: true,
    branch: policy.branch, pr: 0,
  })
  assert.equal(status.readyToClaimDone, true)
})
