const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key])
    return out
  }, {})
}

export const OFFLINE_LEASE_MS = 90_000
export const OFFLINE_BACKOFF_STEPS = Object.freeze([5_000, 15_000, 30_000, 60_000, 120_000, 300_000])

export const createOfflineOperationId = () => `RND-OP-${uuid()}`
export const createOfflineLeaseOwner = () => `RND-LEASE-${uuid()}`
export const stableSerialize = (value) => JSON.stringify(stable(value))

export function retryDelay(attempts = 0, random = Math.random) {
  const base = OFFLINE_BACKOFF_STEPS[Math.min(Math.max(Number(attempts) || 0, 0), OFFLINE_BACKOFF_STEPS.length - 1)]
  const jitter = 0.8 + (Math.min(Math.max(Number(random()) || 0, 0), 1) * 0.4)
  return Math.round(base * jitter)
}

export function canClaimOfflineOperation(op, { ownerId, now = Date.now() } = {}) {
  if (!op) return false
  if (Number(op.nextAttemptAt || 0) > now) return false
  const leaseUntil = Number(op.leaseUntil || 0)
  return !leaseUntil || leaseUntil <= now || op.leaseOwner === ownerId
}

export function withOfflineLease(op, ownerId, now = Date.now()) {
  if (!canClaimOfflineOperation(op, { ownerId, now })) return null
  return {
    ...op,
    leaseOwner: ownerId,
    leaseUntil: now + OFFLINE_LEASE_MS,
  }
}

export function clearOfflineLeasePatch() {
  return { leaseOwner: null, leaseUntil: 0 }
}

export function createIdempotencyIdentity({ hotelId, module, action, recordId = null, payload = null } = {}) {
  const scope = {
    hotelId: text(hotelId),
    module: text(module),
    action: text(action),
    recordId: text(recordId) || null,
    payload: stable(payload),
  }
  for (const field of ['hotelId', 'module', 'action']) {
    if (!scope[field]) throw new TypeError(`idempotency ${field} is required`)
  }
  return `RND-IDEMP:${stableSerialize(scope)}`
}

export function assertExpectedRevision({ expectedRevision, actualRevision } = {}) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new TypeError('expectedRevision must be an integer >= 0')
  if (!Number.isInteger(actualRevision) || actualRevision < 0) throw new TypeError('actualRevision must be an integer >= 0')
  if (expectedRevision !== actualRevision) {
    const error = new Error(`REVISION_CONFLICT:${expectedRevision}!=${actualRevision}`)
    error.code = 'REVISION_CONFLICT'
    error.expectedRevision = expectedRevision
    error.actualRevision = actualRevision
    throw error
  }
  return true
}

export const AmbiguousWriteDecision = Object.freeze({
  REPLAY_RECEIPT: 'REPLAY_RECEIPT',
  CONFIRMED_APPLIED: 'CONFIRMED_APPLIED',
  RETRY_ALLOWED: 'RETRY_ALLOWED',
  ESCALATE: 'ESCALATE',
})

export async function reconcileAmbiguousWrite({ idempotencyKey, findReceipt, readBack, matchesExpected } = {}) {
  if (!text(idempotencyKey)) throw new TypeError('idempotencyKey is required')
  if (typeof findReceipt !== 'function' || typeof readBack !== 'function' || typeof matchesExpected !== 'function') {
    throw new TypeError('findReceipt, readBack and matchesExpected are required')
  }
  const receipt = await findReceipt(idempotencyKey)
  if (receipt) return freeze({ decision: AmbiguousWriteDecision.REPLAY_RECEIPT, receipt })
  let current
  try {
    current = await readBack()
  } catch (error) {
    return freeze({ decision: AmbiguousWriteDecision.ESCALATE, reason: 'READ_BACK_FAILED', error: String(error?.message || error) })
  }
  const applied = await matchesExpected(current)
  if (applied === true) return freeze({ decision: AmbiguousWriteDecision.CONFIRMED_APPLIED, current })
  if (applied === false) return freeze({ decision: AmbiguousWriteDecision.RETRY_ALLOWED, current })
  return freeze({ decision: AmbiguousWriteDecision.ESCALATE, reason: 'AMBIGUOUS_READ_BACK', current })
}

export function validateOutboxOperation(operation, { hotelId } = {}) {
  if (!operation || typeof operation !== 'object') throw new TypeError('outbox operation is required')
  const opHotelId = text(operation.hotelId ?? operation.hotel_id)
  const expectedHotelId = text(hotelId)
  if (!opHotelId || !expectedHotelId) throw new TypeError('outbox hotel scope is required')
  if (opHotelId !== expectedHotelId) {
    const error = new Error('OUTBOX_HOTEL_MISMATCH')
    error.code = 'OUTBOX_HOTEL_MISMATCH'
    throw error
  }
  if (!text(operation.operationId)) throw new TypeError('outbox operationId is required')
  if (!text(operation.idempotencyKey)) throw new TypeError('outbox idempotencyKey is required')
  return true
}
