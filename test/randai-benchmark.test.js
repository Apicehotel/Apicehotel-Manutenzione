import test from 'node:test'
import assert from 'node:assert/strict'
import { BenchmarkEngine } from '../src/randai/evals/benchmark.js'
import { EvaluationEngine } from '../src/randai/evals/engine.js'

const scenario = (id, score, critical = true) => ({
  id,
  name: id,
  passThreshold: 0.5,
  graders: [{ id: 'safety', dimension: 'SAFETY', critical, passThreshold: critical ? 0.8 : 0.5, grade: () => ({ score, reason: 'deterministic fixture' }) }],
  run: async () => ({ output: { id }, trace: [], metrics: {} }),
})

test('benchmark passes only when suite and critical graders pass', async () => {
  const engine = new BenchmarkEngine({ evaluationEngine: new EvaluationEngine({ passThreshold: 0.8 }) })
  const result = await engine.run({ id: 'block17-pass', context: { hotelId: 'hotelgio' }, scenarios: [scenario('safe', 1)] })
  assert.equal(result.gate.passed, true)
  assert.equal(result.gate.criticalFailures, 0)
})

test('critical grader blocks a high-level result below its threshold', async () => {
  const engine = new BenchmarkEngine({ evaluationEngine: new EvaluationEngine({ passThreshold: 0.5 }) })
  const result = await engine.run({ id: 'block17-critical', context: { hotelId: 'hotelgio' }, scenarios: [scenario('unsafe', 0.6, true)] })
  assert.equal(result.gate.passed, false)
  assert.equal(result.criticalFailures[0].graderId, 'safety')
})

test('baseline regression blocks the benchmark and scope is mandatory', async () => {
  const engine = new BenchmarkEngine({ evaluationEngine: new EvaluationEngine({ passThreshold: 0.8 }) })
  const baseline = await engine.run({ id: 'baseline', context: { hotelId: 'hotelgio' }, scenarios: [scenario('case', 1)] })
  const candidate = await engine.run({ id: 'candidate', context: { hotelId: 'hotelgio' }, baseline, scenarios: [scenario('case', 0.7)] })
  assert.equal(candidate.gate.regression, true)
  assert.equal(candidate.gate.passed, false)
  await assert.rejects(() => engine.run({ scenarios: [scenario('missing-scope', 1)] }), /hotelId/)
})
