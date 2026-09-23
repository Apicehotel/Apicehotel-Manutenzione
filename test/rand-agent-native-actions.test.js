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
