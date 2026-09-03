import test from 'node:test'
import assert from 'node:assert/strict'
import { AgentRegistry, AgentRole, MultiAgentRuntime } from '../src/randai/agents/index.js'
import { MultiAgentCoordinator } from '../src/randai/agents/coordinator.js'

const makeCoordinator = (decisions) => {
  const registry = new AgentRegistry({
    agents: [
      { id: 'researcher', role: AgentRole.RESEARCHER, instructions: 'research', tools: [] },
      { id: 'reviewer', role: AgentRole.REVIEWER, instructions: 'review', tools: [] },
    ],
  })
  let index = 0
  const runtime = new MultiAgentRuntime({
    registry,
    invokeAgent: async () => ({ decision: decisions[index++] }),
  })
  return new MultiAgentCoordinator({ runtime })
}

test('returns consensus only when scoped agents agree', async () => {
  const coordinator = makeCoordinator(['CHECK_MOTOR', 'CHECK_MOTOR'])
  const result = await coordinator.run({
    objective: 'valuta clima',
    context: { hotelId: 'hotelgio' },
    tasks: [
      { id: 'research', objective: 'controlla storico', agentRole: AgentRole.RESEARCHER },
      { id: 'review', objective: 'controlla dati', agentRole: AgentRole.REVIEWER },
    ],
    requiredRoles: [AgentRole.RESEARCHER, AgentRole.REVIEWER],
  })
  assert.equal(result.ok, true)
  assert.equal(result.status, 'CONSENSUS')
  assert.equal(result.decision, 'CHECK_MOTOR')
  assert.equal(result.consensus.agreement, 1)
})

test('conflicting agent decisions require human review and expose no decision', async () => {
  const coordinator = makeCoordinator(['CHECK_MOTOR', 'ESCALATE'])
  const result = await coordinator.run({
    objective: 'valuta clima',
    context: { hotelId: 'chocohotel' },
    tasks: [
      { id: 'research', objective: 'controlla storico', agentRole: AgentRole.RESEARCHER },
      { id: 'review', objective: 'controlla dati', agentRole: AgentRole.REVIEWER },
    ],
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 'NEEDS_REVIEW')
  assert.equal(result.decision, null)
  assert.equal(result.consensus.alternatives, 1)
  assert.equal(result.metrics.conflicts, 1)
})

test('refuses coordination without explicit hotel scope', async () => {
  const coordinator = makeCoordinator(['CHECK_MOTOR'])
  await assert.rejects(() => coordinator.run({ objective: 'test', tasks: [{ id: 'one', objective: 'one', agentRole: AgentRole.RESEARCHER }], context: {} }), /hotelId/)
})
