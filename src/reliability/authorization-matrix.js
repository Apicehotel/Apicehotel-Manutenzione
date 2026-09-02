const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)

export const AuthorizationExpectation = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
})

export function createAuthorizationCase({
  id,
  hotelId,
  actorRole,
  module,
  action,
  expected,
  targetHotelId = hotelId,
  metadata = {},
} = {}) {
  const item = {
    id: text(id),
    hotelId: text(hotelId),
    actorRole: text(actorRole),
    module: text(module),
    action: text(action),
    targetHotelId: text(targetHotelId),
    expected: text(expected).toUpperCase(),
    metadata: freeze({ ...(metadata || {}) }),
  }
  for (const field of ['id', 'hotelId', 'actorRole', 'module', 'action', 'targetHotelId']) {
    if (!item[field]) throw new TypeError(`authorization case ${field} is required`)
  }
  if (!Object.values(AuthorizationExpectation).includes(item.expected)) throw new TypeError('invalid authorization expectation')
  return freeze(item)
}

export function validateAuthorizationMatrix(cases = []) {
  if (!Array.isArray(cases) || !cases.length) throw new TypeError('authorization matrix requires at least one case')
  const ids = new Set()
  for (const entry of cases) {
    const item = createAuthorizationCase(entry)
    if (ids.has(item.id)) throw new TypeError(`duplicate authorization case id: ${item.id}`)
    ids.add(item.id)
  }
  return true
}

export async function verifyAuthorizationMatrix(cases, probe) {
  validateAuthorizationMatrix(cases)
  if (typeof probe !== 'function') throw new TypeError('authorization probe is required')

  const results = []
  for (const entry of cases) {
    const item = createAuthorizationCase(entry)
    let allowed = false
    let error = null
    try {
      const response = await probe(item)
      allowed = response === true || response?.allowed === true
    } catch (cause) {
      error = cause
      allowed = false
    }
    const actual = allowed ? AuthorizationExpectation.ALLOW : AuthorizationExpectation.DENY
    results.push(freeze({
      id: item.id,
      expected: item.expected,
      actual,
      ok: actual === item.expected,
      error: error ? String(error.message || error) : null,
    }))
  }

  const failures = results.filter((item) => !item.ok)
  return freeze({ ok: failures.length === 0, results: freeze(results), failures: freeze(failures) })
}

export function assertAuthorizationMatrix(result) {
  if (!result?.ok) {
    const ids = (result?.failures || []).map((item) => item.id).join(', ')
    const error = new Error(`AUTHORIZATION_MATRIX_FAILED${ids ? `: ${ids}` : ''}`)
    error.code = 'AUTHORIZATION_MATRIX_FAILED'
    error.failures = result?.failures || []
    throw error
  }
  return result
}
