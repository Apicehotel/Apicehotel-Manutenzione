const freeze = (value) => Object.freeze(value)

export const AdversarialStatus = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL' })

export async function runAdversarialSuite({ hotelId, scenarios = [] } = {}) {
  if (!hotelId) throw new TypeError('hotelId is required')
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError('scenarios must be a non-empty array')
  const seen = new Set()
  const results = []
  for (const scenario of scenarios) {
    if (!scenario?.id || seen.has(scenario.id)) throw new TypeError('Every adversarial scenario requires a unique id')
    seen.add(scenario.id)
    if (scenario.hotelId && scenario.hotelId !== hotelId) throw new Error(`ADVERSARIAL_HOTEL_SCOPE_MISMATCH:${scenario.id}`)
    if (typeof scenario.run !== 'function' || typeof scenario.assert !== 'function') throw new TypeError(`Scenario ${scenario.id} requires run and assert`)
    try {
      const output = await scenario.run()
      const assertion = await scenario.assert(output)
      const ok = assertion === true || assertion?.ok === true
      results.push(freeze({ id: scenario.id, hotelId, status: ok ? AdversarialStatus.PASS : AdversarialStatus.FAIL, detail: assertion === true ? null : assertion || null }))
    } catch (error) {
      results.push(freeze({ id: scenario.id, hotelId, status: AdversarialStatus.FAIL, error: String(error?.message || error), code: error?.code || null }))
    }
  }
  const failed = results.filter((item) => item.status === AdversarialStatus.FAIL)
  return freeze({ hotelId, ok: failed.length === 0, total: results.length, passed: results.length - failed.length, failed: failed.length, results: freeze(results) })
}

export function assertAdversarialSuite(result) {
  if (!result?.ok) {
    const error = new Error('ADVERSARIAL_RELIABILITY_FAILED')
    error.code = 'ADVERSARIAL_RELIABILITY_FAILED'
    error.result = result
    throw error
  }
  return result
}
