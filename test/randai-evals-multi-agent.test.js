import test from 'node:test'
import assert from 'node:assert/strict'
import { EvaluationEngine, EvalStore, EvalDimension, EvalStatus } from '../src/randai/evals/index.js'
import { AgentRegistry, AgentRole, MultiAgentRuntime, AgentRunStatus } from '../src/randai/agents/index.js'

const agents = [
  { id: 'researcher', role: AgentRole.RESEARCHER, instructions: 'Research evidence', tools: ['web'] },
  { id: 'builder', role: AgentRole.BUILDER, instructions: 'Build change', tools: ['github'] },
  { id: 'tester', role: AgentRole.TESTER, instructions: 'Verify change', tools: ['test'] },
  { id: 'reviewer', role: AgentRole.REVIEWER, instructions: 'Review result', tools: [] },
]

test('evaluation grades outcome and process separately and persists run', async () => {
  const store = new EvalStore()
  const engine = new EvaluationEngine({ store, passThreshold: 0.8 })
  const run = await engine.runScenario({
    id: 'tool-path', name: 'Correct tool path',
    run: async () => ({ output: { ok: true }, trace: [{ type: 'TOOL', id: 'github' }], metrics: { toolCalls: 1 } }),
    graders: [
      { id: 'outcome', dimension: EvalDimension.OUTCOME, weight: 2, grade: ({ execution }) => ({ score: execution.output.ok ? 1 : 0 }) },
      { id: 'process', dimension: EvalDimension.PROCESS, weight: 1, grade: ({ execution }) => ({ score: execution.trace.some((e) => e.id === 'github') ? 1 : 0 }) },
    ],
  })
  assert.equal(run.status, EvalStatus.PASSED)
  assert.equal(run.score, 1)
  assert.equal((await store.get(run.id)).scenarioId, 'tool-path')
  assert.equal(run.grades.length, 2)
})

test('evaluation suite exposes regression against baseline', async () => {
  const engine = new EvaluationEngine()
  const good = await engine.runSuite({ id: 'good', scenarios: [{ id: 's', name: 's', run: async () => ({ output: true }), graders: [{ id: 'g', grade: () => 1 }] }] })
  const bad = await engine.runSuite({ id: 'bad', scenarios: [{ id: 's', name: 's', run: async () => ({ output: false }), graders: [{ id: 'g', grade: () => 0.4 }] }] })
  const comparison = engine.compare(good, bad)
  assert.ok(comparison.scoreDelta < 0)
  assert.equal(comparison.improved, false)
})

test('multi-agent runtime respects dependencies and passes handoff results', async () => {
  const registry = new AgentRegistry({ agents })
  const seen = []
  const runtime = new MultiAgentRuntime({ registry, invokeAgent: async ({ agent, task, dependencyResults }) => {
    seen.push({ role: agent.role, task: task.id, dependencyResults })
    return `${agent.role}:${task.id}`
  } })
  const result = await runtime.run({ objective: 'research build test', tasks: [
    { id: 'research', objective: 'research', agentRole: AgentRole.RESEARCHER },
    { id: 'build', objective: 'build', agentRole: AgentRole.BUILDER, dependsOn: ['research'] },
    { id: 'test', objective: 'test', agentRole: AgentRole.TESTER, dependsOn: ['build'] },
  ] })
  assert.equal(result.ok, true)
  assert.equal(result.statuses.test, AgentRunStatus.SUCCEEDED)
  assert.equal(seen[1].dependencyResults.research, 'RESEARCHER:research')
  assert.equal(seen[2].dependencyResults.build, 'BUILDER:build')
  assert.ok(result.trace.some((e) => e.type === 'HANDOFF_COMPLETED'))
})

test('multi-agent runtime bounds concurrency and agent count', async () => {
  const registry = new AgentRegistry({ agents })
  let active = 0
  let peak = 0
  const runtime = new MultiAgentRuntime({ registry, maxAgents: 3, maxConcurrency: 2, invokeAgent: async ({ task }) => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 10))
    active -= 1
    return task.id
  } })
  const result = await runtime.run({ objective: 'parallel research', tasks: [
    { id: 'a', objective: 'a', agentRole: AgentRole.RESEARCHER },
    { id: 'b', objective: 'b', agentRole: AgentRole.RESEARCHER },
    { id: 'c', objective: 'c', agentRole: AgentRole.RESEARCHER },
  ] })
  assert.equal(result.ok, true)
  assert.ok(peak <= 2)
  await assert.rejects(() => runtime.run({ objective: 'too many', tasks: [
    { id: '1', objective: '1', agentRole: AgentRole.RESEARCHER },
    { id: '2', objective: '2', agentRole: AgentRole.RESEARCHER },
    { id: '3', objective: '3', agentRole: AgentRole.RESEARCHER },
    { id: '4', objective: '4', agentRole: AgentRole.RESEARCHER },
  ] }), /limit exceeded/)
})

test('multi-agent runtime rejects invalid limits and dependency graphs', async () => {
  const registry = new AgentRegistry({ agents })
  assert.throws(() => new MultiAgentRuntime({ registry, maxConcurrency: 0, invokeAgent: async () => null }), /maxConcurrency/)
  assert.throws(() => new MultiAgentRuntime({ registry, maxAgents: Number.NaN, invokeAgent: async () => null }), /maxAgents/)
  const runtime = new MultiAgentRuntime({ registry, invokeAgent: async () => null })
  await assert.rejects(() => runtime.run({ objective: 'bad graph', tasks: [{ id: 'a', objective: 'a', agentRole: AgentRole.RESEARCHER, dependsOn: ['missing'] }] }), /Unknown dependency/)
})

test('failed specialist terminalizes dependent work as skipped', async () => {
  const registry = new AgentRegistry({ agents })
  const runtime = new MultiAgentRuntime({ registry, invokeAgent: async ({ task }) => {
    if (task.id === 'build') throw new Error('build failed')
    return task.id
  } })
  const result = await runtime.run({ objective: 'safe chain', tasks: [
    { id: 'build', objective: 'build', agentRole: AgentRole.BUILDER },
    { id: 'review', objective: 'review', agentRole: AgentRole.REVIEWER, dependsOn: ['build'] },
  ] })
  assert.equal(result.ok, false)
  assert.equal(result.statuses.build, AgentRunStatus.FAILED)
  assert.equal(result.statuses.review, AgentRunStatus.SKIPPED)
  assert.equal(Object.values(result.statuses).includes(AgentRunStatus.PENDING), false)
  assert.ok(result.trace.some((e) => e.type === 'AGENT_FAILED'))
  assert.ok(result.trace.some((e) => e.type === 'DEPENDENCY_BLOCKED' && e.reason === 'UPSTREAM_FAILED'))
})
