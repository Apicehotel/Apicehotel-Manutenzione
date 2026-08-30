import { EvalStatus, validateScenario } from './contracts.js'
import { EvalStore } from './store.js'

const clone = (value) => structuredClone(value)
const makeId = () => `EVAL-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`
const nowIso = () => new Date().toISOString()

export class EvaluationEngine {
  constructor({ store = new EvalStore(), passThreshold = 0.8 } = {}) {
    this.store = store
    this.passThreshold = passThreshold
  }

  async runScenario(scenario, context = {}) {
    validateScenario(scenario)
    const startedAt = nowIso()
    const run = { id: makeId(), suiteId: scenario.suiteId || 'default', scenarioId: scenario.id, scenarioName: scenario.name, status: EvalStatus.RUNNING, score: 0, passed: false, grades: [], output: null, trace: [], metrics: {}, error: null, createdAt: startedAt, updatedAt: startedAt, completedAt: null }
    await this.store.save(run)
    try {
      const execution = await scenario.run(context)
      run.output = clone(execution?.output ?? execution)
      run.trace = clone(execution?.trace || [])
      run.metrics = clone(execution?.metrics || {})
      let weighted = 0
      let weightTotal = 0
      for (const grader of scenario.graders) {
        const result = await grader.grade({ execution, context, scenario })
        const normalized = Math.max(0, Math.min(1, Number(result?.score ?? result ?? 0)))
        const weight = Number(grader.weight || 1)
        weighted += normalized * weight
        weightTotal += weight
        run.grades.push({ id: grader.id, dimension: grader.dimension || null, score: normalized, weight, reason: result?.reason || null, details: clone(result?.details || null) })
      }
      run.score = weightTotal ? weighted / weightTotal : 0
      run.passed = run.score >= Number(scenario.passThreshold ?? this.passThreshold)
      run.status = run.passed ? EvalStatus.PASSED : EvalStatus.FAILED
    } catch (error) {
      run.status = EvalStatus.ERROR
      run.error = { name: error?.name || 'Error', message: error?.message || String(error) }
    }
    run.completedAt = nowIso()
    run.updatedAt = run.completedAt
    await this.store.save(run)
    return clone(run)
  }

  async runSuite({ id = 'suite', scenarios = [] } = {}, context = {}) {
    const runs = []
    for (const scenario of scenarios) runs.push(await this.runScenario({ ...scenario, suiteId: id }, context))
    const score = runs.length ? runs.reduce((sum, run) => sum + run.score, 0) / runs.length : 0
    return { id, runs, score, passed: runs.length > 0 && runs.every((run) => run.passed), failures: runs.filter((run) => !run.passed).map((run) => run.scenarioId) }
  }

  compare(a, b) {
    return { baseline: a.id, candidate: b.id, scoreDelta: Number(b.score || 0) - Number(a.score || 0), passDelta: Number(Boolean(b.passed)) - Number(Boolean(a.passed)), improved: Number(b.score || 0) > Number(a.score || 0) }
  }
}
