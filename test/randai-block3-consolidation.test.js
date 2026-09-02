import test from 'node:test'
import assert from 'node:assert/strict'

import { KnowledgeGapEngine, KnowledgeGapStore, GapScope } from '../src/randai/gaps/index.js'
import { AgentRegistry, AgentRole, MultiAgentRuntime } from '../src/randai/agents/index.js'

test('block 3 / point 12: maintenance gap mutation fails closed without matching hotel scope', async () => {
  const gaps = new KnowledgeGapEngine({ store: new KnowledgeGapStore() })
  const { gap } = await gaps.open({
    scope: GapScope.MAINTENANCE,
    hotelId: 'hotelgio',
    question: 'Dove si trova la valvola di zona?',
    entityType: 'valve',
    entityId: 'zone-1',
  })

  await assert.rejects(() => gaps.propose(gap.id, { answer: 'Locale tecnico' }), /hotelId is required/)
  await assert.rejects(() => gaps.propose(gap.id, { answer: 'Locale tecnico', hotelId: 'chocohotel' }), /requested hotel scope/)

  const proposed = await gaps.propose(gap.id, {
    answer: 'Locale tecnico',
    hotelId: 'hotelgio',
    source: { kind: 'staff_report', id: 'staff-1' },
  })
  assert.equal(proposed.hotelId, 'hotelgio')

  await assert.rejects(() => gaps.resolve(gap.id, {
    approved: true,
    source: { kind: 'procedure', id: 'proc-1' },
  }), /hotelId is required/)

  const resolved = await gaps.resolve(gap.id, {
    approved: true,
    hotelId: 'hotelgio',
    source: { kind: 'procedure', id: 'proc-1' },
  })
  assert.equal(resolved.hotelId, 'hotelgio')
})

test('runtime safety: multi-agent dependency cycles are rejected before execution', async () => {
  const registry = new AgentRegistry({ agents: [
    { id: 'researcher', role: AgentRole.RESEARCHER, instructions: 'research', tools: [] },
  ] })
  let invoked = 0
  const runtime = new MultiAgentRuntime({ registry, invokeAgent: async () => { invoked += 1; return null } })

  await assert.rejects(() => runtime.run({
    objective: 'cyclic plan',
    tasks: [
      { id: 'a', objective: 'A', agentRole: AgentRole.RESEARCHER, dependsOn: ['b'] },
      { id: 'b', objective: 'B', agentRole: AgentRole.RESEARCHER, dependsOn: ['a'] },
    ],
  }), /dependency cycle/)
  assert.equal(invoked, 0)
})
