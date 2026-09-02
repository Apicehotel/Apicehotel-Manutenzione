import test from 'node:test'
import assert from 'node:assert/strict'

import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolPermission, ToolRisk, ToolStatus } from '../src/randai/tools/contracts.js'
import { PermissionAutonomyEngine } from '../src/randai/autonomy/engine.js'
import { AutonomyLevel, AutonomyDecision } from '../src/randai/autonomy/contracts.js'
import { RecoveryEngine } from '../src/randai/recovery/engine.js'
import { RecoveryAction } from '../src/randai/recovery/contracts.js'
import { RandAISupervisor } from '../src/randai/supervisor/engine.js'
import { SupervisorStore } from '../src/randai/supervisor/store.js'
import { ProactiveEngine } from '../src/randai/proactive/engine.js'
import { ProactiveSignalStore } from '../src/randai/proactive/store.js'
import { RandAIControlCenter } from '../src/randai/control-center/engine.js'

class ListStore {
  constructor(items = []) { this.items = items }
  async list(filters = {}) {
    return structuredClone(this.items.filter(item => !filters.projectId || !item.projectId || item.projectId === filters.projectId))
  }
}

test('hardening: L4 still fails closed for critical/admin action until exact approval', async () => {
  let executions = 0
  const registry = new ToolRegistry()
  registry.register({
    id: 'prod.delete',
    name: 'Delete production data',
    permission: ToolPermission.ADMIN,
    risk: ToolRisk.CRITICAL,
    execute: async () => { executions += 1; return { status: ToolStatus.SUCCESS } },
  })

  const autonomy = new PermissionAutonomyEngine({ toolRegistry: registry })
  await autonomy.setPolicy({ id: 'default', level: AutonomyLevel.AUTONOMOUS, maxRisk: ToolRisk.CRITICAL, allowedTools: ['prod.delete'], deniedTools: [] })

  const action = { toolId: 'prod.delete', input: { table: 'x' }, taskId: 'T-HARDEN', stepId: 'S1' }
  const first = await autonomy.authorize(action)
  assert.equal(first.decision, AutonomyDecision.REQUIRE_APPROVAL)
  assert.equal(executions, 0)

  await autonomy.decide(first.approval.id, { approved: true, decidedBy: 'human-test' })
  const second = await autonomy.authorize(action)
  assert.equal(second.decision, AutonomyDecision.ALLOW)

  const altered = await autonomy.authorize({ ...action, input: { table: 'different' } })
  assert.equal(altered.decision, AutonomyDecision.REQUIRE_APPROVAL)
  assert.equal(executions, 0)
})

test('hardening: recovery is bounded and repeated identical failure hits anti-loop', () => {
  const recovery = new RecoveryEngine({ maxSameStrategyAttempts: 1, maxTotalRecoveries: 5, maxRepeatedFingerprint: 2 })
  const task = { recoveryHistory: [] }
  const step = { id: 'S1', strategies: [{ id: 'A', toolId: 'net.fetch' }] }
  const state = { attempts: 0, strategyIndex: 0 }
  const strategy = step.strategies[0]
  const result = { status: ToolStatus.RETRYABLE, error: { code: 'TIMEOUT', message: 'timeout' }, retryable: true }

  const d1 = recovery.decide({ task, step, state, strategy, result })
  assert.equal(d1.action, RecoveryAction.RETRY_SAME)
  recovery.record(task, d1, { stepId: 'S1' })

  const d2 = recovery.decide({ task, step, state, strategy, result })
  recovery.record(task, d2, { stepId: 'S1' })

  const d3 = recovery.decide({ task, step, state, strategy, result })
  assert.equal(d3.action, RecoveryAction.STOP)
  assert.equal(d3.reason, 'ANTI_LOOP_REPEATED_FAILURE')
})

test('hardening: proactive signal routes through supervisor and appears as completed Control Center work', async () => {
  const supervisorStore = new SupervisorStore()
  const signalStore = new ProactiveSignalStore()
  const supervisor = new RandAISupervisor({ store: supervisorStore, qualityThreshold: 0.8 })
  const proactive = new ProactiveEngine({ store: signalStore, supervisor, actThreshold: 'HIGH', cooldownMs: 60_000 })

  const first = await proactive.ingest({ projectId: 'randai', global: true, type: 'BUILD_FAILED', fingerprint: 'build:hardening', severity: 'HIGH', source: 'github-ci' })
  const duplicate = await proactive.ingest({ projectId: 'randai', global: true, type: 'BUILD_FAILED', fingerprint: 'build:hardening', severity: 'HIGH', source: 'observer' })
  assert.equal(first.id, duplicate.id)
  assert.equal(duplicate.count, 2)
  assert.equal(duplicate.suppressedDuplicates, 1)

  const processed = await proactive.process(first.id, {
    global: true,
    executeSingle: async () => ({ ok: true, qualityScore: 0.95, metrics: { agents: 1, toolCalls: 3, retries: 0, cost: 0.1 } }),
  })
  assert.equal(processed.status, 'ACTIONED')
  assert.ok(processed.supervisorRunId)

  const control = new RandAIControlCenter({
    supervisorStore,
    signalStore,
    taskStore: new ListStore(),
    traceStore: new ListStore(),
    approvalStore: new ListStore(),
    discoveryStore: new ListStore(),
    learningStore: new ListStore(),
  })
  const snapshot = await control.snapshot({ projectId: 'randai', allHotels: true })
  assert.equal(snapshot.counts.COMPLETED >= 1, true)
  assert.equal(snapshot.items.some(item => item.id === processed.supervisorRunId && item.section === 'COMPLETED'), true)
})
