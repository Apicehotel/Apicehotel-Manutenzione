import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAIErrorCode } from '../src/randai/core/errors.js'
import { RandAgentPolicyError, RandAgentRuntime } from '../src/randai/agents/orchestration.js'
import { ToolPermission, ToolRisk } from '../src/randai/tools/contracts.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import {
  ToolPermissionGateway,
  ToolPermissionGatewayError,
  bindToolPermissionGateway,
  createRandAgentToolPolicyGuard,
} from '../src/randai/tools/permission-gateway.js'

function registryWith(definition = {}) {
  const registry = new ToolRegistry()
  registry.register({
    id: 'issues.read',
    name: 'Read issues',
    permission: ToolPermission.READ,
    risk: ToolRisk.LOW,
    execute: async () => ({ ok: true }),
    ...definition,
  })
  return registry
}

test('ToolPermissionGateway uses canonical registry permission and risk, never planner downgrades', async () => {
  const registry = registryWith({
    id: 'issues.protected-write',
    name: 'Protected issue mutation',
    permission: ToolPermission.WRITE_PROTECTED,
    risk: ToolRisk.HIGH,
  })
  let observed
  const gateway = new ToolPermissionGateway({
    registry,
    authorize: async (request) => {
      observed = request
      return { allowed: true, actionGateway: true, approvalId: 'approval-1' }
    },
  })
  const decision = await gateway.authorizeTool({
    toolId: 'issues.protected-write',
    context: { hotelId: 'hotelgio' },
    request: { permission: ToolPermission.READ, risk: ToolRisk.LOW },
  })
  assert.equal(observed.tool.permission, ToolPermission.WRITE_PROTECTED)
  assert.equal(observed.tool.risk, ToolRisk.HIGH)
  assert.equal(decision.permission, ToolPermission.WRITE_PROTECTED)
  assert.equal(decision.risk, ToolRisk.HIGH)
  assert.equal(decision.requiresActionGateway, true)
  assert.equal(decision.approvalId, 'approval-1')
})

test('ToolPermissionGateway fails closed for unknown tools and missing hotel scope', async () => {
  const registry = registryWith()
  const gateway = new ToolPermissionGateway({ registry, authorize: async () => true })
  await assert.rejects(
    gateway.authorizeTool({ toolId: 'missing.tool', context: { hotelId: 'hotelgio' } }),
    (error) => error instanceof ToolPermissionGatewayError && error.code === 'RAND_TOOL_UNKNOWN',
  )
  await assert.rejects(
    gateway.authorizeTool({ toolId: 'issues.read', context: {} }),
    (error) => error instanceof ToolPermissionGatewayError && error.code === 'RAND_TOOL_HOTEL_SCOPE_REQUIRED',
  )
})

test('ToolPermissionGateway rejects cross-hotel task/tool scope before authorization', async () => {
  const registry = registryWith()
  let authorizeCalls = 0
  const gateway = new ToolPermissionGateway({ registry, authorize: async () => { authorizeCalls += 1; return true } })
  await assert.rejects(
    gateway.authorizePlan({
      context: { hotelId: 'hotelgio' },
      plan: { tasks: [{ id: 't1', hotelId: 'chocohotel', requiredTools: ['issues.read'] }] },
    }),
    (error) => error.code === 'RAND_TOOL_SCOPE_MISMATCH',
  )
  assert.equal(authorizeCalls, 0)
})

test('protected or critical tools require a real Action Gateway boundary and approval id', async () => {
  const registry = registryWith({
    id: 'admin.mutate',
    name: 'Admin mutation',
    permission: ToolPermission.ADMIN,
    risk: ToolRisk.CRITICAL,
  })
  const gateway = new ToolPermissionGateway({ registry, authorize: async () => ({ allowed: true }) })
  await assert.rejects(
    gateway.authorizeTool({ toolId: 'admin.mutate', context: { hotelId: 'hotelgio' } }),
    (error) => error.code === 'RAND_TOOL_ACTION_GATEWAY_REQUIRED',
  )
})

test('RandAgent policy guard blocks Executor before an unauthorized tool can run', async () => {
  const registry = registryWith()
  const gateway = new ToolPermissionGateway({ registry, authorize: async () => ({ allowed: false, reason: 'role_denied' }) })
  let executorCalls = 0
  const runtime = new RandAgentRuntime({
    executor: { run: async () => { executorCalls += 1; return { ok: true } } },
    planner: async () => ({ tasks: [{ id: 't1', hotelId: 'hotelgio', requiredTools: ['issues.read'] }] }),
    policyGuard: createRandAgentToolPolicyGuard({ gateway }),
  })
  await assert.rejects(
    runtime.run({ objective: 'read issues', context: { hotelId: 'hotelgio' }, runId: 'block2-run' }),
    (error) => error instanceof RandAgentPolicyError && error.code === 'RAND_AGENT_POLICY_DENIED',
  )
  assert.equal(executorCalls, 0)
})

test('guarded ToolRegistry blocks direct execution when permission is denied', async () => {
  let executed = 0
  const registry = registryWith({ execute: async () => { executed += 1; return { ok: true } } })
  const gateway = new ToolPermissionGateway({ registry, authorize: async () => false })
  bindToolPermissionGateway({ registry, gateway })
  await assert.rejects(
    registry.execute('issues.read', {}, { hotelId: 'hotelgio' }),
    (error) => error.code === RandAIErrorCode.PERMISSION_DENIED,
  )
  assert.equal(executed, 0)
})

test('guarded ToolRegistry executes an authorized read tool and actorProvider receives clone-safe descriptor', async () => {
  let executed = 0
  let descriptor
  const registry = registryWith({ execute: async () => { executed += 1; return { ok: true } } })
  const gateway = new ToolPermissionGateway({ registry, authorize: async () => true })
  bindToolPermissionGateway({
    registry,
    gateway,
    actorProvider: async ({ tool }) => { descriptor = tool; return { role: 'RandAI' } },
  })
  const result = await registry.execute('issues.read', {}, { hotelId: 'hotelgio', randAgent: { runId: 'run-guarded' } })
  assert.equal(result.status, 'SUCCESS')
  assert.equal(executed, 1)
  assert.deepEqual(Object.keys(descriptor).sort(), ['id', 'name', 'permission', 'risk'])
  assert.equal(typeof descriptor.execute, 'undefined')
})

test('permission telemetry failures do not grant or revoke authority', async () => {
  const registry = registryWith()
  let telemetryErrors = 0
  const gateway = new ToolPermissionGateway({
    registry,
    authorize: async () => true,
    eventSink: async () => { throw new Error('telemetry offline') },
    onTelemetryError: async () => { telemetryErrors += 1 },
  })
  const decision = await gateway.authorizeTool({ toolId: 'issues.read', context: { hotelId: 'hotelgio' } })
  assert.equal(decision.allowed, true)
  assert.equal(telemetryErrors, 1)
})
