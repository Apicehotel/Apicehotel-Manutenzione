import { assertVikingEvaluation, evaluateOpenViking } from './evaluation.js'
import { buildTieredAuthorizedContext } from './context-projection.js'

export function evaluateVikingProductionGate() {
  const evaluation = evaluateOpenViking()
  const projection = buildTieredAuthorizedContext({ hotelId: 'hotelgio', query: 'test', evidence: [{ id: 'proof', hotelId: 'hotelgio', authorized: true, source: 'gate', content: 'bounded evidence' }] })
  const checks = Object.freeze({ evaluated: assertVikingEvaluation(evaluation), noExternalRuntime: evaluation.installAllowed === false, canonicalAuthority: projection.authority === 'AuthorizedContextEngine', hotelScoped: projection.hotelId === 'hotelgio', noPersistence: projection.persisted === false, observable: projection.trace.length === 1 })
  return Object.freeze({ schema: 'rand.viking-production-gate.v1', status: Object.values(checks).every(Boolean) ? 'PASSED' : 'BLOCKED', decision: evaluation.decision, checks, evaluation })
}
