import test from 'node:test'
import assert from 'node:assert/strict'

import { EvaluationEngine, EvalDimension, EvalStore } from '../src/randai/evals/index.js'
import { AgentRegistry, AgentRole, AgentRunStatus, MultiAgentRuntime } from '../src/randai/agents/index.js'
import { PermissionAutonomyEngine, AutonomyLevel, AutonomyDecision, ApprovalStore, AutonomyPolicyStore, actionIdentity } from '../src/randai/autonomy/index.js'
import { RecoveryEngine, RecoveryAction } from '../src/randai/recovery/index.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolPermission, ToolRisk, ToolStatus } from '../src/randai/tools/contracts.js'

function registryWith(defs) {
  const registry = new ToolRegistry()
  for (const def of defs) registry.register(def)
  return registry
}

async function autonomyFor(registry) {
  const engine = new PermissionAutonomyEngine({ toolRegistry: registry, policyStore: new AutonomyPolicyStore(), approvalStore: new ApprovalStore() })
  await engine.setPolicy({ id: 'default', level: AutonomyLevel.EXECUTE_SAFE, maxRisk: ToolRisk.CRITICAL, allowedTools: [], deniedTools: [] })
  return engine
}

test('block 5 / point 17: evaluation rejects malformed graders, suites and thresholds', async () => {
  assert.throws(() => new EvaluationEngine({ passThreshold: 2 }), /between 0 and 1/)
  const engine = new EvaluationEngine()
  await assert.rejects(() => engine.runScenario({ id: 'bad', name: 'bad', run: async () => true, graders: [
    { id: 'g', dimension: EvalDimension.OUTCOME, grade: () => 1 },
    { id: 'g', dimension: EvalDimension.PROCESS, grade: () => 1 },
  ] }), /Duplicate grader id/)
  await assert.rejects(() => engine.runSuite({ id: 'empty', scenarios: [] }), /at least one scenario/)
})

test('block 5 / point 17: evaluation keeps hotel scope and detects regression', async () => {
  const store = new EvalStore()
  const engine = new EvaluationEngine({ store })
  const scenario = (score) => ({ id: `s-${score}`, name: 'scoped', run: async () => ({ output: true }), graders: [{ id: 'outcome', dimension: EvalDimension.OUTCOME, grade: () => score }] })
  const baseline = await engine.runSuite({ id: 'base', scenarios: [scenario(1)] }, { hotelId: 'hotelgio', projectId: 'randai' })
  const candidate = await engine.runSuite({ id: 'candidate', scenarios: [scenario(0.7)] }, { hotelId: 'hotelgio', projectId: 'randai' })
  assert.equal(baseline.runs[0].hotelId, 'hotelgio')
  assert.equal((await store.list({ hotelId: 'chocohotel' })).length, 0)
  assert.equal(engine.compare(baseline, candidate).regressed, true)
  assert.throws(() => engine.compare(baseline, { ...candidate, hotelId: 'chocohotel' }), /across hotelId/)
})

test('block 5 / point 18: registry rejects duplicate agents and undeclared tools fail before invocation', async () => {
  const registry = new AgentRegistry({ agents: [{ id: 'builder', role: AgentRole.BUILDER, instructions: 'Build', tools: ['github.read'] }] })
  assert.throws(() => registry.register({ id: 'builder', role: AgentRole.BUILDER, instructions: 'Duplicate' }), /already registered/)
  let invoked = 0
  const runtime = new MultiAgentRuntime({ registry, invokeAgent: async () => { invoked += 1; return true } })
  const result = await runtime.run({ objective: 'write', tasks: [{ id: 'write', objective: 'write', agentRole: AgentRole.BUILDER, requiredTools: ['github.write'] }] })
  assert.equal(result.ok, false)
  assert.equal(result.statuses.write, AgentRunStatus.FAILED)
  assert.equal(invoked, 0)
})

test('block 5 / point 18: hotel mismatch is rejected and telemetry cannot crash agent work', async () => {
  const registry = new AgentRegistry({ agents: [{ id: 'tester', role: AgentRole.TESTER, instructions: 'Test' }] })
  const telemetryErrors = []
  const runtime = new MultiAgentRuntime({
    registry,
    invokeAgent: async () => 'ok',
    eventSink: async () => { throw new Error('telemetry down') },
    onTelemetryError: async (event) => telemetryErrors.push(event.error.message),
  })
  await assert.rejects(() => runtime.run({ objective: 'scope', context: { hotelId: 'hotelgio' }, tasks: [{ id: 't', objective: 'test', agentRole: AgentRole.TESTER, hotelId: 'chocohotel' }] }), /hotel scope mismatch/)
  const result = await runtime.run({ objective: 'safe telemetry', tasks: [{ id: 't2', objective: 'test', agentRole: AgentRole.TESTER }] })
  assert.equal(result.ok, true)
  assert.ok(telemetryErrors.length > 0)
})

test('block 5 / point 19: action identity is deterministic and hotel approvals cannot cross structures', async () => {
  const first = actionIdentity({ toolId: 'write', hotelId: 'hotelgio', input: { b: 2, a: 1 } })
  const reordered = actionIdentity({ toolId: 'write', hotelId: 'hotelgio', input: { a: 1, b: 2 } })
  const choco = actionIdentity({ toolId: 'write', hotelId: 'chocohotel', input: { a: 1, b: 2 } })
  assert.equal(first, reordered)
  assert.notEqual(first, choco)

  const tools = registryWith([{ id: 'danger.write', name: 'write', risk: ToolRisk.HIGH, permission: ToolPermission.WRITE_PROTECTED, execute: async () => ({ ok: true }) }])
  const engine = await autonomyFor(tools)
  const gio = await engine.authorize({ toolId: 'danger.write', hotelId: 'hotelgio', input: { room: '1101' }, taskId: 'T', stepId: 'S' })
  assert.equal(gio.decision, AutonomyDecision.REQUIRE_APPROVAL)
  await engine.decide(gio.approval.id, { approved: true, decidedBy: 'direzione', hotelId: 'hotelgio' })
  assert.equal((await engine.authorize({ toolId: 'danger.write', hotelId: 'hotelgio', input: { room: '1101' }, taskId: 'T', stepId: 'S' })).decision, AutonomyDecision.ALLOW)
  assert.equal((await engine.authorize({ toolId: 'danger.write', hotelId: 'chocohotel', input: { room: '1101' }, taskId: 'T', stepId: 'S' })).decision, AutonomyDecision.REQUIRE_APPROVAL)
  const pendingChoco = await engine.authorize({ toolId: 'danger.write', hotelId: 'chocohotel', input: { room: '1101' }, taskId: 'T2', stepId: 'S' })
  await assert.rejects(() => engine.decide(pendingChoco.approval.id, { approved: true, decidedBy: 'direzione', hotelId: 'hotelgio' }), /scope mismatch/)
})

test('block 5 / point 19: autonomy policy contradictions and invalid approval ttl fail fast', async () => {
  const tools = registryWith([{ id: 'read', name: 'read', risk: ToolRisk.LOW, permission: ToolPermission.READ, execute: async () => ({ ok: true }) }])
  assert.throws(() => new PermissionAutonomyEngine({ toolRegistry: tools, approvalTtlMs: 0 }), /approvalTtlMs/)
  const engine = new PermissionAutonomyEngine({ toolRegistry: tools })
  await assert.rejects(() => engine.setPolicy({ id: 'bad', level: AutonomyLevel.EXECUTE_SAFE, allowedTools: ['read'], deniedTools: ['read'] }), /both allowed and denied/)
})

test('block 5 / point 20: recovery budgets fail fast and scope mismatch cannot self-correct', () => {
  assert.throws(() => new RecoveryEngine({ maxTotalRecoveries: 0 }), /maxTotalRecoveries/)
  const recovery = new RecoveryEngine({ maxSameStrategyAttempts: 2, maxRepeatedFingerprint: 2 })
  assert.throws(() => recovery.decide({
    task: { metadata: { hotelId: 'hotelgio' }, recoveryHistory: [] },
    step: { id: 's', hotelId: 'chocohotel', strategies: [{ id: 'a', toolId: 'net' }] },
    state: { attempts: 1, strategyIndex: 0 }, strategy: { id: 'a', toolId: 'net' },
    result: { status: ToolStatus.RETRYABLE, retryable: true }, verification: { ok: false, reason: 'network' },
  }), /hotel scope mismatch/)
})

test('block 5 / point 20: safety and permission failures always escalate instead of retrying', () => {
  const recovery = new RecoveryEngine()
  const base = { task: { metadata: { hotelId: 'hotelgio' }, recoveryHistory: [] }, step: { id: 's', strategies: [{ id: 'a', toolId: 'admin' }] }, state: { attempts: 1, strategyIndex: 0 }, strategy: { id: 'a', toolId: 'admin' } }
  const permission = recovery.decide({ ...base, result: { status: ToolStatus.PERMISSION_DENIED, error: { code: 'PERMISSION_DENIED', message: 'denied' } }, verification: { ok: false, reason: 'denied' } })
  const safety = recovery.decide({ ...base, result: { status: ToolStatus.FAILED }, verification: { ok: false, reason: 'unsafe condition' } })
  assert.equal(permission.action, RecoveryAction.ASK_HUMAN)
  assert.equal(safety.action, RecoveryAction.ASK_HUMAN)
})
