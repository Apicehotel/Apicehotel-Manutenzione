import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  assertRandActionSurface,
  getRandActionDefinition,
  listRandActions,
  mapRandActionInput,
} from '../src/randai/actions/catalog.js'
import { getActionDefinition } from '../supabase/functions/_shared/randai-action-policy.js'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { registerRandActionTools } from '../src/randai/actions/agent-tools.js'

test('shared Rand actions stay aligned with server authorization policy', () => {
  const actions = listRandActions()
  assert.deepEqual(actions.map((item) => item.id), [
    'issue.update_priority',
    'issue.set_waiting_part',
    'issue.mark_done',
  ])

  for (const action of actions) {
    const policy = getActionDefinition(action.id)
    assert.ok(policy, `missing server policy for ${action.id}`)
    assert.equal(action.surfaces.randapp, true)
    assert.equal(action.surfaces.agent, true)
    assert.equal(action.surfaces.mcp, true)
    assert.equal(action.surfaces.public, false)
    assert.equal(action.needsApproval, policy.approvalRequired)
    assert.equal(action.risk, policy.risk)
    assert.equal(Object.isFrozen(action), true)
  }
})

test('shared action input mapping is deterministic and server-shaped', () => {
  assert.deepEqual(mapRandActionInput('issue.update_priority', { priority: 'alta' }), { priority: 'alta' })
  assert.deepEqual(mapRandActionInput('issue.set_waiting_part', { partName: 'Ventola' }), { part_name: 'Ventola' })
  assert.deepEqual(mapRandActionInput('issue.mark_done', { completionNote: '' }), { completion_note: null })
})

test('unknown or unexposed actions fail closed', () => {
  assert.equal(getRandActionDefinition('missing'), null)
  assert.throws(() => assertRandActionSurface('missing', 'mcp'), /not available/)
  assert.throws(() => listRandActions({ surface: 'public' }), /Unknown Rand action surface/)
})

test('RandApp and MCP consume the shared action catalog instead of defining a second action list', () => {
  const mcp = fs.readFileSync('api/mcp.js', 'utf8')
  const browser = fs.readFileSync('src/randai/action-gateway.js', 'utf8')
  assert.match(mcp, /listRandActions\(\{ surface: 'mcp' \}\)/)
  assert.match(mcp, /mapRandActionInput/)
  assert.doesNotMatch(mcp, /server\.registerTool\(['"]issue\./)
  assert.match(browser, /getRandActionDefinition/)
})


test('RandAI agent tools are generated from the same catalog and require governed dispatch', async () => {
  const registry = new ToolRegistry()
  assert.throws(() => registerRandActionTools({ registry }), /governed dispatch/)

  let observed
  const registered = registerRandActionTools({
    registry,
    dispatch: async (request) => {
      observed = request
      return { ok: true }
    },
  })

  assert.deepEqual(registered.map((tool) => tool.id), listRandActions({ surface: 'agent' }).map((action) => action.id))
  const result = await registry.execute('issue.set_waiting_part', {
    hotelId: 'hotelgio',
    resourceId: '00000000-0000-4000-8000-000000000001',
    partName: 'Ventola',
  })

  assert.equal(result.status, 'SUCCESS')
  assert.equal(observed.actionId, 'issue.set_waiting_part')
  assert.equal(observed.hotelId, 'hotelgio')
  assert.deepEqual(observed.input, { part_name: 'Ventola' })
  await assert.rejects(
    () => registry.execute('issue.mark_done', { resourceId: '00000000-0000-4000-8000-000000000001' }),
    /requires hotelId and resourceId/,
  )
})
