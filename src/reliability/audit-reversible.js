const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)
const nowIso = () => new Date().toISOString()

export const AuditOutcome = Object.freeze({
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  COMPENSATED: 'compensated',
})

export function createAuditRecord({
  operationId,
  hotelId,
  actorId,
  module,
  action,
  target = {},
  before = null,
  after = null,
  outcome,
  verified = false,
  correlationId = null,
  reason = null,
  createdAt = null,
  metadata = {},
} = {}) {
  const record = {
    version: 1,
    operationId: text(operationId),
    hotelId: text(hotelId),
    actorId: text(actorId),
    module: text(module),
    action: text(action),
    target: freeze({ type: text(target?.type), id: text(target?.id) }),
    before,
    after,
    outcome: text(outcome).toLowerCase(),
    verified: verified === true,
    correlationId: text(correlationId) || null,
    reason: text(reason) || null,
    createdAt: text(createdAt) || nowIso(),
    metadata: freeze({ ...(metadata || {}) }),
  }
  for (const field of ['operationId', 'hotelId', 'actorId', 'module', 'action']) {
    if (!record[field]) throw new TypeError(`audit ${field} is required`)
  }
  if (!Object.values(AuditOutcome).includes(record.outcome)) throw new TypeError('invalid audit outcome')
  if (Number.isNaN(Date.parse(record.createdAt))) throw new TypeError('audit createdAt must be a valid ISO date')
  return freeze(record)
}

export function createCompensationRequest({
  original,
  operationId,
  actorId,
  reason,
  expectedCurrent = null,
  metadata = {},
} = {}) {
  if (!original || typeof original !== 'object') throw new TypeError('original audit record is required')
  if (!original.verified || original.outcome !== AuditOutcome.SUCCEEDED) {
    throw new Error('only verified successful operations can be compensated')
  }
  const request = {
    version: 1,
    operationId: text(operationId),
    originalOperationId: text(original.operationId),
    hotelId: text(original.hotelId),
    actorId: text(actorId),
    module: text(original.module),
    action: `compensate:${text(original.action)}`,
    reason: text(reason),
    restoreValue: original.before,
    expectedCurrent: expectedCurrent ?? original.after,
    metadata: freeze({ ...(metadata || {}) }),
  }
  for (const field of ['operationId', 'originalOperationId', 'hotelId', 'actorId', 'module', 'reason']) {
    if (!request[field]) throw new TypeError(`compensation ${field} is required`)
  }
  if (request.operationId === request.originalOperationId) throw new TypeError('compensation must use a distinct operationId')
  return freeze(request)
}

export async function executeCompensation({ request, authorize, readCurrent, writeRestore, verify, audit } = {}) {
  if (!request) throw new TypeError('compensation request is required')
  for (const [name, fn] of Object.entries({ authorize, readCurrent, writeRestore, verify, audit })) {
    if (typeof fn !== 'function') throw new TypeError(`${name} function is required`)
  }
  const allowed = await authorize(request)
  if (allowed !== true) throw new Error('COMPENSATION_NOT_AUTHORIZED')
  const current = await readCurrent(request)
  if (request.expectedCurrent !== null && JSON.stringify(current) !== JSON.stringify(request.expectedCurrent)) {
    const error = new Error('COMPENSATION_CONFLICT')
    error.code = 'COMPENSATION_CONFLICT'
    throw error
  }
  await writeRestore(request.restoreValue, request)
  const restored = await readCurrent(request)
  const ok = await verify(restored, request.restoreValue, request)
  if (ok !== true) throw new Error('COMPENSATION_VERIFY_FAILED')
  const receipt = createAuditRecord({
    operationId: request.operationId,
    hotelId: request.hotelId,
    actorId: request.actorId,
    module: request.module,
    action: request.action,
    target: {},
    before: current,
    after: restored,
    outcome: AuditOutcome.COMPENSATED,
    verified: true,
    reason: request.reason,
    metadata: { originalOperationId: request.originalOperationId, ...request.metadata },
  })
  await audit(receipt)
  return freeze({ ok: true, restored, receipt })
}
