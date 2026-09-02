export const EvalStatus = Object.freeze({ PENDING: 'PENDING', RUNNING: 'RUNNING', PASSED: 'PASSED', FAILED: 'FAILED', ERROR: 'ERROR' })
export const EvalDimension = Object.freeze({ OUTCOME: 'OUTCOME', PROCESS: 'PROCESS', TOOL_USE: 'TOOL_USE', EFFICIENCY: 'EFFICIENCY', SAFETY: 'SAFETY', MEMORY: 'MEMORY', PLANNING: 'PLANNING', RECOVERY: 'RECOVERY', PROJECT: 'PROJECT' })

export function validateThreshold(value, name = 'passThreshold') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new TypeError(`${name} must be a finite number between 0 and 1`)
  return numeric
}

export function validateScenario(scenario) {
  if (!scenario?.id || !scenario?.name) throw new TypeError('Evaluation scenario requires id and name')
  if (typeof scenario.run !== 'function') throw new TypeError('Evaluation scenario requires run function')
  if (!Array.isArray(scenario.graders) || scenario.graders.length === 0) throw new TypeError('Evaluation scenario requires graders')
  if (scenario.passThreshold != null) validateThreshold(scenario.passThreshold, 'Scenario passThreshold')
  const graderIds = new Set()
  for (const grader of scenario.graders) {
    if (!grader?.id || typeof grader.grade !== 'function') throw new TypeError('Each grader requires id and grade function')
    if (graderIds.has(grader.id)) throw new TypeError(`Duplicate grader id: ${grader.id}`)
    graderIds.add(grader.id)
    if (grader.dimension != null && !Object.values(EvalDimension).includes(grader.dimension)) throw new TypeError(`Invalid evaluation dimension: ${grader.dimension}`)
    if (grader.weight != null && (!Number.isFinite(Number(grader.weight)) || Number(grader.weight) <= 0)) throw new TypeError('Grader weight must be positive')
  }
  return true
}
