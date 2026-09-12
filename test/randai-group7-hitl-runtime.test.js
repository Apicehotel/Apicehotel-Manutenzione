import test from 'node:test'
import assert from 'node:assert/strict'
import { ExecutionDisposition, RiskClass, executionPolicyForTool } from '../src/randai/runtime/risk-policy.js'
import { assertSandboxDescriptor, sandboxPolicyForTool } from '../src/randai/runtime/sandbox.js'
import { RandHITLRuntime } from '../src/randai/runtime/hitl-runtime.js'

const tool = (id, permission, risk) => ({ id, permission, risk })

test('risk policy maps read/low/medium/high/critical deterministically', () => {
  assert.equal(executionPolicyForTool(tool('read','READ','LOW')).riskClass, RiskClass.READ_ONLY)
  assert.equal(executionPolicyForTool(tool('low','WRITE','LOW')).disposition, ExecutionDisposition.AUTO)
  assert.equal(executionPolicyForTool(tool('medium','WRITE','MEDIUM')).disposition, ExecutionDisposition.PREVIEW)
  assert.equal(executionPolicyForTool(tool('high','WRITE_PROTECTED','HIGH')).disposition, ExecutionDisposition.REQUIRE_APPROVAL)
  assert.equal(executionPolicyForTool(tool('critical','ADMIN','CRITICAL')).disposition, ExecutionDisposition.BLOCK)
})

test('sandbox never permits unrestricted host execution', () => {
  const descriptor = sandboxPolicyForTool(tool('read','READ','LOW'))
  assert.equal(descriptor.hostExecution, false)
  assert.throws(() => assertSandboxDescriptor({ mode: 'PURE', hostExecution: true }), /UNRESTRICTED_HOST_EXECUTION_DENIED/)
})

test('HITL runtime keeps approval behind canonical approval adapter', async () => {
  const preparedIds = []
  const runtime = new RandHITLRuntime({
    prepareApproval: async ({ tool }) => { preparedIds.push(tool.id); return { approvalId: 'ap_1' } },
    executeApproved: async (approval) => ({ ok: true, approval }),
  })
  const prepared = await runtime.prepare({ tool: tool('delete','WRITE_PROTECTED','HIGH'), input: { id: 1 }, context: { hotelId: 'gio' } })
  assert.equal(prepared.status, 'APPROVAL_REQUIRED')
  assert.deepEqual(preparedIds, ['delete'])
  await assert.rejects(() => runtime.execute({ prepared }), /HUMAN_APPROVAL_REQUIRED/)
  const result = await runtime.execute({ prepared, approved: true })
  assert.equal(result.ok, true)
})

test('medium risk requires preview while critical stays blocked', async () => {
  const runtime = new RandHITLRuntime()
  const medium = await runtime.prepare({ tool: tool('edit','WRITE','MEDIUM') })
  assert.equal(medium.status, 'PREVIEW_REQUIRED')
  await assert.rejects(() => runtime.execute({ prepared: medium }), /PREVIEW_CONFIRMATION_REQUIRED/)
  assert.equal((await runtime.execute({ prepared: medium, approved: true })).status, 'READY_FOR_TOOL_EXECUTION')
  const critical = await runtime.prepare({ tool: tool('root','ADMIN','CRITICAL') })
  assert.equal(critical.status, 'BLOCKED')
  await assert.rejects(() => runtime.execute({ prepared: critical }), /ACTION_BLOCKED/)
})
