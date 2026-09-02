import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAIOrchestrator } from '../src/randai/core/orchestrator.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { ToolRisk, ToolPermission, ToolStatus, toolSuccess } from '../src/randai/tools/contracts.js'

test('a new tool can be registered and executed without changing the orchestrator', async () => {
  const registry = new ToolRegistry()
  registry.register({
    id: 'demo.echo', name: 'Echo', description: 'Returns the supplied value',
    risk: ToolRisk.LOW, permission: ToolPermission.READ,
    execute: async input => toolSuccess({ echo: input.value }),
  })
  const orchestrator = new RandAIOrchestrator({ registry, logger: { child: () => ({ info() {} }) } })
  const { task, result } = await orchestrator.executeTool({ objective: 'Echo test', toolId: 'demo.echo', input: { value: 'ok' } })
  assert.equal(result.status, ToolStatus.SUCCESS)
  assert.deepEqual(result.data, { echo: 'ok' })
  assert.equal(task.status, 'SUCCEEDED')
  assert.match(task.id, /^RND-\d{8}-\d{6}$/)
})

test('registry discovery filters by capability metadata', () => {
  const registry = new ToolRegistry()
  registry.register({ id: 'github.read_file', name: 'Read GitHub file', description: 'Read repository content', risk: ToolRisk.LOW, permission: ToolPermission.READ, execute() {} })
  registry.register({ id: 'github.merge', name: 'Merge branch', description: 'Merge protected code', risk: ToolRisk.HIGH, permission: ToolPermission.WRITE_PROTECTED, execute() {} })
  assert.deepEqual(registry.discover({ maxRisk: ToolRisk.LOW }).map(t => t.id), ['github.read_file'])
  assert.deepEqual(registry.discover({ text: 'merge' }).map(t => t.id), ['github.merge'])
  assert.throws(() => registry.discover({ maxRisk: 'UNKNOWN' }), /Invalid tool maxRisk filter/)
  assert.throws(() => registry.discover({ permission: 'ROOT' }), /Invalid tool permission filter/)
})

test('tool definitions are normalized immutably and reject unsafe retry configuration', () => {
  const registry = new ToolRegistry()
  const registered = registry.register({
    id: 'demo.retry',
    name: 'Retry demo',
    retryPolicy: { maxAttempts: 3, delayMs: 5 },
    execute: async () => toolSuccess('ok'),
  })
  assert.equal(Object.isFrozen(registered), true)
  assert.equal(Object.isFrozen(registered.retryPolicy), true)
  assert.deepEqual(registered.retryPolicy, { maxAttempts: 3, delayMs: 5 })
  assert.throws(() => registry.register({ id: 'bad.retry', name: 'Bad retry', retryPolicy: { maxAttempts: 0 }, execute() {} }), /maxAttempts/)
  assert.throws(() => registry.register({ id: 'bad.timeout', name: 'Bad timeout', timeoutMs: 0, execute() {} }), /timeoutMs/)
})

test('tool health is observable and unavailable tools are not executed', async () => {
  const registry = new ToolRegistry()
  let executed = false
  registry.register({ id: 'offline.tool', name: 'Offline', healthCheck: async () => false, execute: async () => { executed = true } })
  assert.deepEqual(await registry.health(), [{ id: 'offline.tool', status: 'UNAVAILABLE', details: false }])
  await assert.rejects(() => registry.execute('offline.tool', {}), /Tool unavailable/)
  assert.equal(executed, false)
})

test('orchestrator closes the task as FAILED when registry execution throws', async () => {
  const registry = new ToolRegistry()
  const orchestrator = new RandAIOrchestrator({ registry, logger: { child: () => ({ info() {}, error() {} }) } })
  let failure
  try {
    await orchestrator.executeTool({ objective: 'Missing tool must fail safely', toolId: 'missing.tool', input: {} })
  } catch (error) {
    failure = error
  }
  assert.ok(failure)
  assert.equal(failure.task?.status, 'FAILED')
  assert.equal(failure.task?.events?.at(-1)?.status, 'FAILED')
  assert.ok(failure.task?.completedAt)
})
