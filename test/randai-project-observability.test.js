import test from 'node:test'
import assert from 'node:assert/strict'
import { ProjectGraph, ProjectGraphStore, ProjectIntelligenceEngine, ProjectNodeType, ProjectEdgeType } from '../src/randai/projects/index.js'
import { ObservabilityEngine, TraceStore, TraceStatus, SpanStatus } from '../src/randai/observability/index.js'
import { AgentRegistry, MultiAgentRuntime } from '../src/randai/agents/index.js'

function sampleGraph() {
  return new ProjectGraph({
    projectId: 'randai',
    nodes: [
      { id: 'assistant', type: ProjectNodeType.FILE, path: 'src/randai/RandAIAssistant.jsx' },
      { id: 'decision', type: ProjectNodeType.MODULE, path: 'src/randai/maintenance/decision-engine.js' },
      { id: 'procedures', type: ProjectNodeType.TABLE, name: 'randai_procedures' },
      { id: 'decision-test', type: ProjectNodeType.TEST, path: 'test/randai-smart-maintenance-guidance.test.js' },
    ],
    edges: [
      { from: 'assistant', to: 'decision', type: ProjectEdgeType.IMPORTS },
      { from: 'decision', to: 'procedures', type: ProjectEdgeType.READS },
      { from: 'decision', to: 'decision-test', type: ProjectEdgeType.TESTS },
    ],
  })
}

test('project graph provides downstream impact analysis with tests and database nodes', () => {
  const impact = sampleGraph().impact('assistant')
  assert.deepEqual(impact.affected.map((node) => node.id), ['decision', 'procedures', 'decision-test'])
  assert.equal(impact.databases[0].id, 'procedures')
  assert.equal(impact.tests[0].id, 'decision-test')
})

test('project graph diff is deterministic and detects topology changes', () => {
  const first = sampleGraph()
  const next = first.snapshot()
  next.nodes.push({ id: 'trace', type: ProjectNodeType.MODULE })
  next.edges.push({ from: 'decision', to: 'trace', type: ProjectEdgeType.EMITS })
  const diff = first.diff(next)
  assert.deepEqual(diff.addedNodes, ['trace'])
  assert.deepEqual(diff.addedEdges, ['decision|EMITS|trace'])
})

test('project intelligence merges scanner evidence and persists an updateable graph', async () => {
  const store = new ProjectGraphStore()
  const engine = new ProjectIntelligenceEngine({
    store,
    scanners: [
      { id: 'github', scan: async () => ({ nodes: [{ id: 'assistant', type: ProjectNodeType.FILE, path: 'src/randai/RandAIAssistant.jsx' }, { id: 'decision', type: ProjectNodeType.MODULE }], edges: [{ from: 'assistant', to: 'decision', type: ProjectEdgeType.IMPORTS }], metadata: { ref: 'main' } }) },
      { id: 'supabase', scan: async () => ({ nodes: [{ id: 'decision', type: ProjectNodeType.MODULE }, { id: 'procedures', type: ProjectNodeType.TABLE }], edges: [{ from: 'decision', to: 'procedures', type: ProjectEdgeType.READS }], metadata: { schema: 'public' } }) },
    ],
  })
  const first = await engine.scan({ projectId: 'randai' })
  assert.deepEqual(first.graph.nodes.find((node) => node.id === 'decision').sources.sort(), ['github', 'supabase'])
  assert.equal(first.graph.sources.length, 2)
  const persistedImpact = await engine.impact('randai', 'assistant')
  assert.deepEqual(persistedImpact.affected.map((node) => node.id), ['decision', 'procedures'])
})

test('observability trace records spans events and weighted progress from real completed work', async () => {
  const engine = new ObservabilityEngine({ store: new TraceStore() })
  const trace = await engine.startTrace({ name: 'Fix auth', projectId: 'randai', taskId: 'TASK-1' })
  const analyse = await engine.startSpan(trace.id, { name: 'analyse', kind: 'AGENT' })
  const build = await engine.startSpan(trace.id, { name: 'build', kind: 'TOOL' })
  await engine.emit(trace.id, 'TOOL_CALL', { toolId: 'github.read' }, { spanId: build.id })
  await engine.endSpan(trace.id, analyse.id)
  let progress = await engine.progress(trace.id, { weights: { analyse: 1, build: 3 } })
  assert.equal(progress.percent, 25)
  await engine.endSpan(trace.id, build.id, { status: SpanStatus.SUCCEEDED })
  progress = await engine.progress(trace.id, { weights: { analyse: 1, build: 3 } })
  assert.equal(progress.percent, 100)
  const completed = await engine.completeTrace(trace.id, { ok: true })
  assert.equal(completed.status, TraceStatus.SUCCEEDED)
  assert.equal(completed.events[0].type, 'TOOL_CALL')
})

test('multi-agent runtime awaits observability event persistence and leaves complete trace', async () => {
  const registry = new AgentRegistry()
  registry.register({ id: 'researcher', role: 'researcher', name: 'Researcher', instructions: 'Research the assigned task and return evidence.' })
  registry.register({ id: 'builder', role: 'builder', name: 'Builder', instructions: 'Build the assigned task from verified dependencies.' })
  const observability = new ObservabilityEngine({ store: new TraceStore() })
  const trace = await observability.startTrace({ name: 'multi-agent' })
  const runtime = new MultiAgentRuntime({
    registry,
    maxConcurrency: 2,
    eventSink: observability.eventSink(trace.id),
    invokeAgent: async ({ task }) => ({ taskId: task.id }),
  })
  const result = await runtime.run({
    objective: 'research and build',
    tasks: [
      { id: 'r', agentRole: 'researcher', input: {} },
      { id: 'b', agentRole: 'builder', input: {}, dependsOn: ['r'] },
    ],
  })
  assert.equal(result.ok, true)
  const persisted = await observability.get(trace.id)
  assert.equal(persisted.events.at(-1).data.type, 'MULTI_AGENT_COMPLETED')
  assert.equal(persisted.events.filter((event) => event.data.type === 'HANDOFF_COMPLETED').length, 2)
})

test('invalid project edge is rejected instead of inventing topology', () => {
  assert.throws(() => new ProjectGraph({ projectId: 'x', nodes: [{ id: 'a', type: ProjectNodeType.FILE }], edges: [{ from: 'a', to: 'missing', type: ProjectEdgeType.DEPENDS_ON }] }), /unknown node/i)
})
