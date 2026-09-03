import { EvaluationEngine } from './engine.js'
import { validateThreshold } from './contracts.js'

const clone = (value) => value == null ? value : structuredClone(value)

function criticalFailures(scenarios, runs, defaultThreshold) {
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
  return runs.flatMap((run) => {
    const scenario = byId.get(run.scenarioId)
    return (run.grades || []).filter((grade) => {
      const grader = scenario?.graders?.find((item) => item.id === grade.id)
      const threshold = validateThreshold(grader?.passThreshold ?? defaultThreshold, 'Grader passThreshold')
      return grader?.critical === true && grade.score < threshold
    }).map((grade) => ({
      scenarioId: run.scenarioId,
      graderId: grade.id,
      dimension: grade.dimension,
      score: grade.score,
      threshold: validateThreshold(scenario?.graders?.find((item) => item.id === grade.id)?.passThreshold ?? defaultThreshold, 'Grader passThreshold'),
      reason: grade.reason || null,
    }))
  })
}

export class BenchmarkEngine {
  constructor({ evaluationEngine = new EvaluationEngine(), passThreshold = evaluationEngine.passThreshold } = {}) {
    this.evaluationEngine = evaluationEngine
    this.passThreshold = validateThreshold(passThreshold)
  }

  async run({ id = 'benchmark', scenarios = [], context = {}, baseline = null, regressionTolerance = 0 } = {}) {
    if (!String(id || '').trim()) throw new TypeError('Benchmark id is required')
    if (!context?.hotelId) throw new TypeError('Benchmark requires explicit hotelId scope')
    if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('Benchmark requires at least one scenario')
    const suite = await this.evaluationEngine.runSuite({ id, scenarios }, context)
    const critical = criticalFailures(scenarios, suite.runs, this.passThreshold)
    const comparison = baseline ? this.evaluationEngine.compare(baseline, suite, { regressionTolerance }) : null
    const regression = comparison?.regressed === true
    return {
      ...clone(suite),
      benchmarkId: id,
      hotelId: context.hotelId,
      gate: {
        passed: suite.passed && critical.length === 0 && !regression,
        score: suite.score,
        passThreshold: this.passThreshold,
        criticalFailures: critical.length,
        regression,
      },
      criticalFailures: critical,
      comparison,
    }
  }
}
