import { EvalStatus, validateScenario, validateThreshold } from './contracts.js'
import { EvalStore } from './store.js'

const clone = (value) => structuredClone(value)
const makeId = () => `EVAL-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`
const nowIso = () => new Date().toISOString()

export class EvaluationEngine {
  constructor({ store = new EvalStore(), passThreshold = 0.8 } = {}) {
    this.store = store
    this.passThreshold = validateThreshold(passThreshold)
  }

  async runScenario(scenario, context = {}) {
    validateScenario(scenario)
    const startedAt = nowIso()
    const scope = {
      hotelId: context.hotelId || scenario.hotelId || null,
      projectId: context.projectId || scenario.projectId || null,
      taskId: context.taskId || scenario.taskId || null,
    }
    const run = { id: makeId(), suiteId: scenario.suiteId || 'default', scenarioId: scenario.id, scenarioName: scenario.name, ...scope, status: EvalStatus.RUNNING, score: 0, passed: false, grades: [], output: null, trace: [], metrics: {}, error: null, createdAt: startedAt, updatedAt: startedAt, completedAt: null }
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
        const rawScore = Number(result?.score ?? result ?? 0)
        if (!Number.isFinite(rawScore)) throw new TypeError(`Grader ${grader.id} returned a non-finite score`)
        const normalized = Math.max(0, Math.min(1, rawScore))
        const weight = Number(grader.weight || 1)
        weighted += normalized * weight
        weightTotal += weight
        run.grades.push({ id: grader.id, dimension: grader.dimension || null, score: normalized, weight, reason: result?.reason || null, details: clone(result?.details || null) })
      }
      run.score = weightTotal ? weighted / weightTotal : 0
      run.passed = run.score >= validateThreshold(scenario.passThreshold ?? this.passThreshold, 'Scenario passThreshold')
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
    if (!String(id || '').trim()) throw new TypeError('Evaluation suite id is required')
    if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('Evaluation suite requires at least one scenario')
    if (new Set(scenarios.map((scenario) => scenario?.id)).size !== scenarios.length) throw new TypeError('Evaluation suite scenario ids must be unique')
    const runs = []
    for (const scenario of scenarios) runs.push(await this.runScenario({ ...scenario, suiteId: id }, context))
    const score = runs.reduce((sum, run) => sum + run.score, 0) / runs.length
    return { id, hotelId: context.hotelId || null, projectId: context.projectId || null, taskId: context.taskId || null, runs, score, passed: runs.every((run) => run.passed), failures: runs.filter((run) => !run.passed).map((run) => run.scenarioId) }
  }

  compare(a, b, { regressionTolerance = 0 } = {}) {
    const tolerance = Number(regressionTolerance)
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) throw new TypeError('regressionTolerance must be between 0 and 1')
    if (!a?.id || !b?.id) throw new TypeError('baseline and candidate suites are required')
    for (const key of ['hotelId', 'projectId', 'taskId']) {
      if (a[key] && b[key] && a[key] !== b[key]) throw new Error(`Cannot compare evaluation suites across ${key}`)
    }
    const scoreDelta = Number(b.score || 0) - Number(a.score || 0)
    const passDelta = Number(Boolean(b.passed)) - Number(Boolean(a.passed))
    const regressed = scoreDelta < -tolerance || (a.passed === true && b.passed !== true)
    return { baseline: a.id, candidate: b.id, scoreDelta, passDelta, improved: scoreDelta > tolerance, regressed, regressionTolerance: tolerance }
  }
}
