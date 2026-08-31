let operationSequence = 0

const nowIso = () => new Date().toISOString()
const nextId = () => globalThis.crypto?.randomUUID
  ? `RND-OP-${globalThis.crypto.randomUUID()}`
  : `RND-OP-${Date.now()}-${String(++operationSequence).padStart(6, '0')}`

const textOrNull = (value) => {
  const text = String(value ?? '').trim()
  return text || null
}

export const OperationSource = Object.freeze({
  USER: 'user',
  RANDAI: 'randai',
  SYSTEM: 'system',
  IMPORT: 'import',
  SYNC: 'sync',
})

export const OperationOutcome = Object.freeze({
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  BLOCKED: 'blocked',
})

export function createOperationEnvelope({
  operationId = null,
  correlationId = null,
  traceId = null,
  hotelId,
  userId = null,
  role = null,
  module,
  action,
  recordType = null,
  recordId = null,
  source = OperationSource.SYSTEM,
  createdAt = null,
  metadata = {},
} = {}) {
  const envelope = {
    version: 1,
    operationId: textOrNull(operationId) || nextId(),
    correlationId: textOrNull(correlationId),
    traceId: textOrNull(traceId),
    hotelId: textOrNull(hotelId),
    actor: Object.freeze({
      userId: textOrNull(userId),
      role: textOrNull(role),
    }),
    module: textOrNull(module),
    action: textOrNull(action),
    record: Object.freeze({
      type: textOrNull(recordType),
      id: textOrNull(recordId),
    }),
    source: textOrNull(source) || OperationSource.SYSTEM,
    createdAt: textOrNull(createdAt) || nowIso(),
    metadata: Object.freeze({ ...(metadata || {}) }),
  }

  validateOperationEnvelope(envelope)
  return Object.freeze(envelope)
}

export function validateOperationEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new TypeError('operation envelope is required')
  for (const field of ['operationId', 'hotelId', 'module', 'action', 'source', 'createdAt']) {
    if (!textOrNull(envelope[field])) throw new TypeError(`${field} is required`)
  }
  if (!/^RND-OP-/.test(envelope.operationId)) throw new TypeError('operationId must use the RND-OP namespace')
  if (Number.isNaN(Date.parse(envelope.createdAt))) throw new TypeError('createdAt must be a valid ISO date')
  return true
}

export function operationLogContext(envelope, extra = {}) {
  validateOperationEnvelope(envelope)
  return {
    operationId: envelope.operationId,
    correlationId: envelope.correlationId,
    traceId: envelope.traceId,
    hotelId: envelope.hotelId,
    module: envelope.module,
    action: envelope.action,
    recordType: envelope.record.type,
    recordId: envelope.record.id,
    source: envelope.source,
    ...extra,
  }
}

export function withOperationOutcome(envelope, outcome, details = {}) {
  validateOperationEnvelope(envelope)
  if (!Object.values(OperationOutcome).includes(outcome)) throw new TypeError('invalid operation outcome')
  return Object.freeze({
    operationId: envelope.operationId,
    outcome,
    completedAt: nowIso(),
    details: Object.freeze({ ...(details || {}) }),
  })
}
