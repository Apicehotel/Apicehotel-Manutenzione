const finite01 = (value, name) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new TypeError(`${name} must be finite 0..1`)
  return n
}

export function evaluateReleaseGate({ checks = {}, metrics = {}, thresholds = {} } = {}) {
  const requiredChecks = ['security','quality','critical','multihotel','build','contracts','browser','device','adversarial']
  const failures = requiredChecks.filter((name) => checks[name] !== true).map((name) => ({ code: 'CHECK_FAILED', check: name }))
  const limits = {
    maxFailureRate: finite01(thresholds.maxFailureRate ?? 0.02, 'maxFailureRate'),
    maxVerificationFailureRate: finite01(thresholds.maxVerificationFailureRate ?? 0.01, 'maxVerificationFailureRate'),
    maxRollbackRate: finite01(thresholds.maxRollbackRate ?? 0.05, 'maxRollbackRate'),
  }
  const values = {
    failureRate: finite01(metrics.failureRate ?? 0, 'failureRate'),
    verificationFailureRate: finite01(metrics.verificationFailureRate ?? 0, 'verificationFailureRate'),
    rollbackRate: finite01(metrics.rollbackRate ?? 0, 'rollbackRate'),
  }
  if (values.failureRate > limits.maxFailureRate) failures.push({ code: 'FAILURE_RATE_REGRESSION', actual: values.failureRate, limit: limits.maxFailureRate })
  if (values.verificationFailureRate > limits.maxVerificationFailureRate) failures.push({ code: 'VERIFICATION_RATE_REGRESSION', actual: values.verificationFailureRate, limit: limits.maxVerificationFailureRate })
  if (values.rollbackRate > limits.maxRollbackRate) failures.push({ code: 'ROLLBACK_RATE_REGRESSION', actual: values.rollbackRate, limit: limits.maxRollbackRate })
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures), metrics: Object.freeze(values), thresholds: Object.freeze(limits) })
}

export function assertReleaseGate(input) {
  const result = evaluateReleaseGate(input)
  if (!result.ok) {
    const error = new Error('PRODUCTION_RELEASE_BLOCKED')
    error.code = 'PRODUCTION_RELEASE_BLOCKED'
    error.result = result
    throw error
  }
  return result
}
