import test from 'node:test'
import assert from 'node:assert/strict'

import { MaintenanceDecisionEngine } from '../src/randai/maintenance/decision-engine.js'
import { KnowledgeTrust } from '../src/randai/maintenance/contracts.js'
import { validateGuidedProcedure } from '../src/randai/guidance/contracts.js'
import { GuidedProcedureEngine } from '../src/randai/guidance/engine.js'
import { GuidanceStore } from '../src/randai/guidance/store.js'
import { validateProjectGraph, ProjectNodeType, ProjectEdgeType } from '../src/randai/projects/contracts.js'
import { ObservabilityEngine } from '../src/randai/observability/engine.js'
import { SpanStatus, TraceStatus } from '../src/randai/observability/contracts.js'

test('block 4 / point 13: approved procedure outranks a highly similar prior experience', async () => {
  const engine = new MaintenanceDecisionEngine({
    knowledgeEngine: {
      search() {
        return {
          found: true,
          score: 1,
          procedure: {
            id: 'PROC-1',
            title: 'Reset centralina',
            summary: 'Procedura verificata',
            version: 3,
            trust: KnowledgeTrust.APPROVED,
          },
        }
      },
    },
    memoryEngine: {
      async recall() {
        return [{ id: 'MEM-1', summary: 'reset centralina reset centralina', content: 'reset centralina', trust: 'verified' }]
      },
    },
  })

  const result = await engine.assess({ hotelId: 'gio', report: 'reset centralina' })
  assert.equal(result.suggestions[0].kind, 'procedure')
  assert.equal(result.suggestions[0].actionable, true)
  assert.equal(result.suggestions.find((item) => item.kind === 'experience')?.actionable, false)
  assert.equal(result.canStartGuidance, true)
})

test('block 4 / point 14: guided procedures reject unreachable zombie steps and endless graphs', () => {
  const base = {
    id: 'PROC-GUIDE',
    hotelId: 'gio',
    title: 'Guida prova',
    steps: [
      { id: 's1', title: 'Primo', next: { DONE: 's2' } },
      { id: 's2', title: 'Fine', next: {} },
    ],
  }
  assert.equal(validateGuidedProcedure(base), true)

  assert.throws(() => validateGuidedProcedure({
    ...base,
    steps: [...base.steps, { id: 'zombie', title: 'Mai raggiunto', next: {} }],
  }), /Unreachable guided steps: zombie/)

  assert.throws(() => validateGuidedProcedure({
    ...base,
    steps: [
      { id: 's1', title: 'Uno', next: { DONE: 's2' } },
      { id: 's2', title: 'Due', next: { DONE: 's1' } },
    ],
  }), /reachable terminal step/)
})

test('block 4 / point 14: guidance reads can be hotel-scoped', async () => {
  const store = new GuidanceStore()
  const engine = new GuidedProcedureEngine({ store })
  const session = await engine.start({
    procedure: {
      id: 'PROC-SCOPE',
      hotelId: 'gio',
      title: 'Scope test',
      steps: [{ id: 's1', title: 'Fine', next: {} }],
    },
  })

  assert.equal((await engine.current(session.id, { hotelId: 'gio' })).session.hotelId, 'gio')
  await assert.rejects(() => engine.current(session.id, { hotelId: 'choco' }), /requested scope/)
})

test('block 4 / point 15: project graph rejects duplicate semantic edges', () => {
  const graph = {
    projectId: 'randai',
    nodes: [
      { id: 'a', type: ProjectNodeType.MODULE },
      { id: 'b', type: ProjectNodeType.TEST },
    ],
    edges: [
      { from: 'a', to: 'b', type: ProjectEdgeType.TESTS },
      { from: 'a', to: 'b', type: ProjectEdgeType.TESTS },
    ],
  }
  assert.throws(() => validateProjectGraph(graph), /Duplicate project edge/)
})

test('block 4 / point 16: observability cannot report success with open spans', async () => {
  const engine = new ObservabilityEngine()
  const trace = await engine.startTrace({ name: 'maintenance-operation' })
  const span = await engine.startSpan(trace.id, { name: 'diagnose' })

  await assert.rejects(() => engine.completeTrace(trace.id), /open spans/)
  await assert.rejects(() => engine.emit(trace.id, 'bad-event', {}, { spanId: 'missing' }), /Unknown event span/)
  await assert.rejects(() => engine.progress(trace.id, { weights: { diagnose: 0 } }), /Invalid observability weight/)

  await engine.endSpan(trace.id, span.id, { status: SpanStatus.SUCCEEDED })
  const completed = await engine.completeTrace(trace.id)
  assert.equal(completed.status, TraceStatus.SUCCEEDED)
})

test('block 4 / point 16: telemetry failures stay non-fatal but surface self-diagnostics', async () => {
  const diagnostics = []
  const engine = new ObservabilityEngine({ onTelemetryError: (entry) => diagnostics.push(entry) })
  const sink = engine.eventSink('missing-trace')
  const result = await sink({ type: 'AGENT_STARTED' })
  assert.equal(result, null)
  assert.equal(diagnostics.length, 1)
  assert.match(diagnostics[0].error.message, /Unknown trace/)
})
