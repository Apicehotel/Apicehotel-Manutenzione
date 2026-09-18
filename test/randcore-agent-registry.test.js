import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AgentRuntimeStatus,
  RAND_AGENTS,
  RAND_ECOSYSTEM_COMPONENTS,
  RAND_MODULES,
  buildAgentRuntimeBoard,
  deriveAgentRuntimeStatus,
} from '../src/randai/control-center/agent-registry.js'

test('runtime registry exposes the executable Rand units', () => {
  const ids = RAND_AGENTS.map((agent) => agent.id)
  for (const expected of ['randai','randbrain','randcore','randmind','randradar','randresearch','randsecure','randtest','randops','randui']) {
    assert.ok(ids.includes(expected), `missing ${expected}`)
  }
  assert.equal(new Set(ids).size, ids.length)
})

test('ecosystem keeps non-runtime Rand components visible without fake heartbeat state', () => {
  const ids = RAND_ECOSYSTEM_COMPONENTS.map((component) => component.id)
  for (const expected of ['randguide','randaudio','randskills','randcontrol','randcontext','randvisual','randarchitecture','randchat','randgateway','randmcp','randeye']) {
    assert.ok(ids.includes(expected), `missing ${expected}`)
  }
  assert.ok(RAND_MODULES.every((component) => component.runtime === false))
  assert.ok(!RAND_AGENTS.some((component) => component.id === 'randeye'))
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

test('board always includes every registered runtime unit', () => {
  const now = Date.parse('2026-09-17T21:00:00Z')
  const board = buildAgentRuntimeBoard([
    { agentId: 'randtest', heartbeatAt: '2026-09-17T20:59:30Z', taskId: 'quality-gate', activity: 'Esecuzione test' },
  ], now)
  assert.equal(board.length, RAND_AGENTS.length)
  assert.equal(board.find((agent) => agent.id === 'randtest')?.status, AgentRuntimeStatus.RUNNING)
  assert.equal(board.find((agent) => agent.id === 'randbrain')?.status, AgentRuntimeStatus.OFFLINE)
})
