import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAgentInspectionError, RandAgentPolicyError, RandAgentRuntime, RandAgentStage } from '../src/randai/agents/orchestration.js'

const executor = (impl = async ({ tasks, context }) => ({ ok: true, results: { task: { output: { tasks: tasks.length, runId: context.randAgent.runId } } } })) => ({ run: impl })

test('RandAgentRuntime runs Planner -> Policy -> Executor -> Inspector and propagates run context', async () => {
  const calls = []
  const runtime = new RandAgentRuntime({
    executor: executor(async ({ tasks, context }) => { calls.push('executor'); return { ok: true, tasks, runId: context.randAgent.runId } }),
    planner: async ({ context }) => { calls.push('planner'); assert.equal(context.hotelId, 'gio'); return { tasks: [{ id: 't1' }] } },
    contextProvider: async () => { calls.push('context'); return { hotelId: 'gio', loadedBy: 'randmind-hook' } },
    policyGuard: async ({ context }) => { calls.push('policy'); return { allowed: context.hotelId === 'gio' } },
    inspector: async ({ execution }) => { calls.push('inspector'); return { ok: execution.ok, quality: 1 } },
    eventSink: async () => calls.push('event'),
  })
  const result = await runtime.run({ objective: 'fix issue', channel: 'web', runId: 'run-1' })
  assert.equal(result.ok, true)
  assert.equal(result.runId, 'run-1')
  assert.equal(result.channel, 'web')
  assert.equal(result.execution.runId, 'run-1')
  assert.equal(result.replans, 0)
  assert.ok(calls.indexOf('context') < calls.indexOf('planner'))
  assert.ok(calls.indexOf('planner') < calls.indexOf('policy'))
  assert.ok(calls.indexOf('policy') < calls.indexOf('executor'))
  assert.ok(calls.indexOf('executor') < calls.indexOf('inspector'))
  assert.deepEqual(result.trace.filter((event) => event.type === 'RAND_AGENT_STAGE').map((event) => event.stage), [
    RandAgentStage.RECEIVED,
    RandAgentStage.CONTEXT_LOADED,
    RandAgentStage.PLANNED,
    RandAgentStage.POLICY_CHECKED,
    RandAgentStage.EXECUTED,
    RandAgentStage.INSPECTED,
    RandAgentStage.COMPLETED,
  ])
})

test('RandAgentRuntime performs one bounded replan after failed inspection', async () => {
  const attempts = []
  const runtime = new RandAgentRuntime({
    executor: executor(),
    maxReplans: 1,
    planner: async ({ attempt, previousInspection }) => {
      attempts.push({ attempt, previousInspection })
      return { tasks: [{ id: `task-${attempt}` }] }
    },
    inspector: async ({ attempt }) => ({ ok: attempt === 1, reason: attempt === 0 ? 'needs repair' : undefined }),
  })
  const result = await runtime.run({ objective: 'repair', runId: 'run-2' })
  assert.equal(result.ok, true)
  assert.equal(result.attempts, 2)
  assert.equal(result.replans, 1)
  assert.equal(attempts[1].previousInspection.reason, 'needs repair')
  assert.equal(result.trace.filter((event) => event.type === 'RAND_AGENT_REPLAN_REQUESTED').length, 1)
})

test('RandAgentRuntime stops after maxReplans instead of looping forever', async () => {
  const runtime = new RandAgentRuntime({
    executor: executor(),
    maxReplans: 1,
    planner: async ({ attempt }) => ({ tasks: [{ id: `task-${attempt}` }] }),
    inspector: async () => ({ ok: false, reason: 'still broken' }),
  })
  await assert.rejects(() => runtime.run({ objective: 'repair', runId: 'run-3' }), (error) => {
    assert.ok(error instanceof RandAgentInspectionError)
    assert.equal(error.code, 'RAND_AGENT_INSPECTION_FAILED')
    assert.equal(error.details.replans, 1)
    return true
  })
})

test('RandAgentRuntime denies execution before executor when policy rejects it', async () => {
  let executed = false
  const runtime = new RandAgentRuntime({
    executor: executor(async () => { executed = true; return { ok: true } }),
    planner: async () => ({ tasks: [] }),
    policyGuard: async () => ({ allowed: false, reason: 'role denied' }),
  })
  await assert.rejects(() => runtime.run({ objective: 'delete', runId: 'run-4' }), (error) => {
    assert.ok(error instanceof RandAgentPolicyError)
    assert.equal(error.code, 'RAND_AGENT_POLICY_DENIED')
    assert.equal(error.message, 'role denied')
    return true
  })
  assert.equal(executed, false)
})

test('legacy verifier is supported as inspector compatibility alias', async () => {
  let verified = 0
  const runtime = new RandAgentRuntime({
    executor: executor(),
    planner: async () => ({ tasks: [] }),
    verifier: async () => { verified += 1; return true },
  })
  const result = await runtime.run({ objective: 'legacy flow', runId: 'run-5' })
  assert.equal(result.ok, true)
  assert.equal(verified, 1)
})

test('telemetry failures do not break the agent run', async () => {
  let telemetryErrors = 0
  const runtime = new RandAgentRuntime({
    executor: executor(),
    planner: async () => ({ tasks: [] }),
    eventSink: async () => { throw new Error('sink offline') },
    onTelemetryError: async () => { telemetryErrors += 1 },
  })
  const result = await runtime.run({ objective: 'continue safely', runId: 'run-6' })
  assert.equal(result.ok, true)
  assert.ok(telemetryErrors >= 1)
})
