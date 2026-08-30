export const EvalStatus = Object.freeze({ PENDING: 'PENDING', RUNNING: 'RUNNING', PASSED: 'PASSED', FAILED: 'FAILED', ERROR: 'ERROR' })
export const EvalDimension = Object.freeze({ OUTCOME: 'OUTCOME', PROCESS: 'PROCESS', TOOL_USE: 'TOOL_USE', EFFICIENCY: 'EFFICIENCY', SAFETY: 'SAFETY', MEMORY: 'MEMORY', PLANNING: 'PLANNING', RECOVERY: 'RECOVERY', PROJECT: 'PROJECT' })

export function validateScenario(scenario) {
  if (!scenario?.id || !scenario?.name) throw new TypeError('Evaluation scenario requires id and name')
  if (typeof scenario.run !== 'function') throw new TypeError('Evaluation scenario requires run function')
  if (!Array.isArray(scenario.graders) || scenario.graders.length === 0) throw new TypeError('Evaluation scenario requires graders')
  for (const grader of scenario.graders) {
    if (!grader?.id || typeof grader.grade !== 'function') throw new TypeError('Each grader requires id and grade function')
    if (grader.weight != null && (!Number.isFinite(Number(grader.weight)) || Number(grader.weight) <= 0)) throw new TypeError('Grader weight must be positive')
  }
  return true
}
