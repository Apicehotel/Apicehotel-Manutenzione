export const RandFocusPhase = Object.freeze({
  DISCOVER: 'DISCOVER',
  PLAN: 'PLAN',
  IMPLEMENT: 'IMPLEMENT',
  TEST: 'TEST',
  SECURITY: 'SECURITY',
  REVIEW: 'REVIEW',
  DONE: 'DONE',
})

export function buildRandFocusStatus({
  taskId,
  title,
  phase,
  completed = 0,
  total = 0,
  nextAction = '',
  errors = [],
  remaining = [],
  testsPassed = false,
  securityPassed = false,
  ciPassed = false,
  branch = null,
  pr = null,
} = {}) {
  if (!taskId || !title) throw new TypeError('RandFocus requires taskId and title')
  if (!Object.values(RandFocusPhase).includes(phase)) throw new TypeError('Valid RandFocus phase required')
  if (!Number.isInteger(completed) || !Number.isInteger(total) || completed < 0 || total < 0 || completed > total) throw new TypeError('Invalid RandFocus progress counters')

  const blockers = [...errors, ...remaining]
  if (phase === RandFocusPhase.DONE) {
    if (completed !== total) throw new Error('RandFocus cannot report DONE with remaining progress')
    if (!testsPassed) throw new Error('RandFocus cannot report DONE before tests pass')
    if (!securityPassed) throw new Error('RandFocus cannot report DONE before security gates pass')
    if (!ciPassed) throw new Error('RandFocus cannot report DONE before CI passes')
    if (blockers.length > 0) throw new Error('RandFocus cannot report DONE with unresolved work')
  }

  return Object.freeze({
    version: 'RAND_FOCUS_V1',
    taskId,
    title,
    phase,
    completed,
    total,
    nextAction: String(nextAction || ''),
    errors: Object.freeze([...errors]),
    remaining: Object.freeze([...remaining]),
    testsPassed: Boolean(testsPassed),
    securityPassed: Boolean(securityPassed),
    ciPassed: Boolean(ciPassed),
    branch,
    pr,
    readyToClaimDone: completed === total && testsPassed && securityPassed && ciPassed && blockers.length === 0,
  })
}
