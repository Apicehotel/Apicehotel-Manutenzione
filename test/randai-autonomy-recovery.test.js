import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolPermission, ToolRisk, ToolStatus } from '../src/randai/tools/contracts.js'
import { PermissionAutonomyEngine, AutonomyLevel, AutonomyDecision, ApprovalStore, AutonomyPolicyStore } from '../src/randai/autonomy/index.js'
import { RecoveryEngine, RecoveryAction } from '../src/randai/recovery/index.js'
import { DurableTaskRunner } from '../src/randai/runtime/durable-runner.js'
import { RandAIPlanner } from '../src/randai/runtime/planner.js'
import { RandAIVerifier } from '../src/randai/runtime/verifier.js'
import { MemoryTaskStore } from '../src/randai/runtime/store.js'
import { RuntimeTaskStatus } from '../src/randai/runtime/contracts.js'

function registryWith(defs) {
  const registry = new ToolRegistry()
  for (const def of defs) registry.register(def)
  return registry
}

function autonomy(registry, level = AutonomyLevel.EXECUTE_SAFE) {
  const engine = new PermissionAutonomyEngine({ toolRegistry: registry, policyStore: new AutonomyPolicyStore(), approvalStore: new ApprovalStore() })
  return engine.setPolicy({ id: 'default', level, maxRisk: ToolRisk.CRITICAL, allowedTools: [], deniedTools: [] }).then(() => engine)
}

test('autonomy levels fail closed and critical/admin actions always require approval', async () => {
  const registry = registryWith([
    { id: 'read.low', name: 'read', risk: ToolRisk.LOW, permission: ToolPermission.READ, execute: async () => ({ ok: true }) },
    { id: 'write.high', name: 'write', risk: ToolRisk.HIGH, permission: ToolPermission.WRITE_PROTECTED, execute: async () => ({ ok: true }) },
    { id: 'admin.critical', name: 'admin', risk: ToolRisk.CRITICAL, permission: ToolPermission.ADMIN, execute: async () => ({ ok: true }) },
  ])
  const engine = await autonomy(registry, AutonomyLevel.OBSERVE)
  assert.equal((await engine.evaluate({ toolId: 'read.low' })).decision, AutonomyDecision.OBSERVE_ONLY)
  await engine.setPolicy({ id: 'default', level: AutonomyLevel.PREPARE, maxRisk: ToolRisk.CRITICAL, allowedTools: [], deniedTools: [] })
  assert.equal((await engine.evaluate({ toolId: 'write.high' })).decision, AutonomyDecision.PREPARE_ONLY)
  await engine.setPolicy({ id: 'default', level: AutonomyLevel.AUTONOMOUS, maxRisk: ToolRisk.CRITICAL, allowedTools: [], deniedTools: [] })
  assert.equal((await engine.evaluate({ toolId: 'admin.critical' })).decision, AutonomyDecision.REQUIRE_APPROVAL)
})

test('approval is bound to exact action identity and survives reevaluation', async () => {
  const registry = registryWith([{ id: 'danger.write', name: 'write', risk: ToolRisk.HIGH, permission: ToolPermission.WRITE_PROTECTED, execute: async () => ({ ok: true }) }])
  const engine = await autonomy(registry)
  const blocked = await engine.authorize({ toolId: 'danger.write', input: { branch: 'feature' }, taskId: 'T1', stepId: 'S1' })
  assert.equal(blocked.decision, AutonomyDecision.REQUIRE_APPROVAL)
  assert.equal(blocked.approval.status, 'PENDING')
  await engine.decide(blocked.approval.id, { approved: true, decidedBy: 'human-1' })
  assert.equal((await engine.authorize({ toolId: 'danger.write', input: { branch: 'feature' }, taskId: 'T1', stepId: 'S1' })).decision, AutonomyDecision.ALLOW)
  assert.equal((await engine.authorize({ toolId: 'danger.write', input: { branch: 'main' }, taskId: 'T1', stepId: 'S1' })).decision, AutonomyDecision.REQUIRE_APPROVAL)
})

test('recovery retries transient failures then changes strategy and stops repeated loops', () => {
  const recovery = new RecoveryEngine({ maxSameStrategyAttempts: 2, maxRepeatedFingerprint: 1 })
  const task = { recoveryHistory: [], decisions: [] }
  const step = { id: 's', strategies: [{ id: 'a', toolId: 'net' }, { id: 'b', toolId: 'alt' }] }
  const state = { attempts: 1, strategyIndex: 0 }
  const first = recovery.decide({ task, step, state, strategy: step.strategies[0], result: { status: ToolStatus.RETRYABLE, retryable: true, error: { code: 'NETWORK_ERROR', message: 'offline' } }, verification: { ok: false, reason: 'network' } })
  assert.equal(first.action, RecoveryAction.RETRY_SAME)
  recovery.record(task, first, { stepId: 's' })
  const repeated = recovery.decide({ task, step, state, strategy: step.strategies[0], result: { status: ToolStatus.RETRYABLE, retryable: true, error: { code: 'NETWORK_ERROR', message: 'offline' } }, verification: { ok: false, reason: 'network' } })
  assert.equal(repeated.action, RecoveryAction.STOP)
  assert.equal(repeated.reason, 'ANTI_LOOP_REPEATED_FAILURE')
})

test('durable runtime pauses before protected action and resumes only after exact approval', async () => {
  let calls = 0
  const registry = registryWith([{ id: 'repo.write', name: 'write repo', risk: ToolRisk.HIGH, permission: ToolPermission.WRITE_PROTECTED, execute: async () => { calls += 1; return { status: ToolStatus.SUCCESS, data: { ok: true } } } }])
  const autonomyEngine = await autonomy(registry)
  const planner = new RandAIPlanner()
  const verifier = new RandAIVerifier()
  const store = new MemoryTaskStore()
  const runner = new DurableTaskRunner({ planner, registry, verifier, store, autonomyEngine, recoveryEngine: new RecoveryEngine() })
  const task = await runner.create({ objective: 'write safely', proposedPlan: { steps: [{ id: 'write', title: 'write', strategies: [{ toolId: 'repo.write', input: { branch: 'feature' } }] }] } })
  const paused = await runner.resume(task.id)
  assert.equal(paused.status, RuntimeTaskStatus.BLOCKED)
  assert.equal(calls, 0)
  const approvalId = paused.decisions.at(-1).approvalId
  await autonomyEngine.decide(approvalId, { approved: true, decidedBy: 'reviewer' })
  const finished = await runner.resume(task.id)
  assert.equal(finished.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(calls, 1)
})

test('recovery-controlled transient retry succeeds without infinite replay', async () => {
  let calls = 0
  const registry = registryWith([{ id: 'net.read', name: 'network read', risk: ToolRisk.LOW, permission: ToolPermission.READ, execute: async () => { calls += 1; return calls === 1 ? { status: ToolStatus.RETRYABLE, retryable: true, error: { code: 'NETWORK_ERROR', message: 'temporary' } } : { status: ToolStatus.SUCCESS, data: { ok: true } } } }])
  const autonomyEngine = await autonomy(registry)
  const runner = new DurableTaskRunner({ planner: new RandAIPlanner(), registry, verifier: new RandAIVerifier(), store: new MemoryTaskStore(), autonomyEngine, recoveryEngine: new RecoveryEngine({ maxSameStrategyAttempts: 2 }) })
  const task = await runner.create({ objective: 'read with recovery', proposedPlan: { steps: [{ id: 'read', title: 'read', strategies: [{ toolId: 'net.read' }] }] } })
  const finished = await runner.resume(task.id)
  assert.equal(finished.status, RuntimeTaskStatus.SUCCEEDED)
  assert.equal(calls, 2)
  assert.equal(finished.recoveryHistory[0].action, RecoveryAction.RETRY_SAME)
})
