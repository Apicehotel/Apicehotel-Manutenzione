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
})

test('tool health is observable and unavailable tools are not executed', async () => {
  const registry = new ToolRegistry()
  let executed = false
  registry.register({ id: 'offline.tool', name: 'Offline', healthCheck: async () => false, execute: async () => { executed = true } })
  assert.deepEqual(await registry.health(), [{ id: 'offline.tool', status: 'UNAVAILABLE', details: false }])
  await assert.rejects(() => registry.execute('offline.tool', {}), /Tool unavailable/)
  assert.equal(executed, false)
})
