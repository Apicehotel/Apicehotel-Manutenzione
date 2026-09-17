import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AgentRuntimeStatus,
  RAND_AGENTS,
  buildAgentRuntimeBoard,
  deriveAgentRuntimeStatus,
} from '../src/randai/control-center/agent-registry.js'

test('agent registry exposes the expected Rand workers', () => {
  const ids = RAND_AGENTS.map((agent) => agent.id)
  for (const expected of ['randai', 'randradar', 'randui', 'randtest', 'randsecure', 'randops', 'randcore', 'randmind']) {
    assert.ok(ids.includes(expected), `missing ${expected}`)
  }
})

test('fresh heartbeat plus task means running', () => {
  const now = Date.parse('2026-09-17T21:00:00Z')
  const status = deriveAgentRuntimeStatus({
    heartbeatAt: '2026-09-17T20:59:00Z',
    taskId: 'task-1',
  }, now)
  assert.equal(status, AgentRuntimeStatus.RUNNING)
})

test('stale heartbeat means offline', () => {
  const now = Date.parse('2026-09-17T21:10:00Z')
  const status = deriveAgentRuntimeStatus({
    heartbeatAt: '2026-09-17T21:00:00Z',
  }, now)
  assert.equal(status, AgentRuntimeStatus.OFFLINE)
})

test('approval and error states override heartbeat derived state', () => {
  const now = Date.parse('2026-09-17T21:00:00Z')
  assert.equal(deriveAgentRuntimeStatus({ status: 'WAITING_APPROVAL' }, now), AgentRuntimeStatus.WAITING_APPROVAL)
  assert.equal(deriveAgentRuntimeStatus({ status: 'ERROR' }, now), AgentRuntimeStatus.ERROR)
})

test('board always includes every registered agent', () => {
  const now = Date.parse('2026-09-17T21:00:00Z')
  const board = buildAgentRuntimeBoard([
    { agentId: 'randtest', heartbeatAt: '2026-09-17T20:59:30Z', taskId: 'quality-gate', activity: 'Esecuzione test' },
  ], now)
  assert.equal(board.length, RAND_AGENTS.length)
  assert.equal(board.find((agent) => agent.id === 'randtest')?.status, AgentRuntimeStatus.RUNNING)
  assert.equal(board.find((agent) => agent.id === 'randops')?.status, AgentRuntimeStatus.OFFLINE)
})
