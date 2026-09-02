const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)

export const ScopeDecision = Object.freeze({
  ALLOW: 'ALLOW',
  BLOCK: 'BLOCK',
})

export const ScopeReason = Object.freeze({
  MISSING_CONTEXT: 'MISSING_CONTEXT',
  HOTEL_MISMATCH: 'HOTEL_MISMATCH',
  ACTOR_MISMATCH: 'ACTOR_MISMATCH',
  RESOURCE_MISMATCH: 'RESOURCE_MISMATCH',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  OWNERSHIP_MISMATCH: 'OWNERSHIP_MISMATCH',
  MODULE_MISMATCH: 'MODULE_MISMATCH',
  SOURCE_MISMATCH: 'SOURCE_MISMATCH',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
})

function add(reasons, reason, detail = null) {
  reasons.push(freeze({ reason, detail }))
}

export function evaluateContextScope({
  expected = {},
  context = null,
  record = null,
  permissionAllowed = null,
  requireActor = false,
  requireResource = false,
  requireModule = false,
  ownership = null,
} = {}) {
  const reasons = []
  const expectedHotelId = text(expected.hotelId)
  const expectedUserId = text(expected.userId)
  const expectedModule = text(expected.module)
  const expectedRecordId = text(expected.recordId)
  const expectedRecordType = text(expected.recordType)
  const expectedSource = text(expected.source)
  const expectedVersion = expected.version ?? null

  if (!expectedHotelId || !expectedModule) add(reasons, ScopeReason.MISSING_CONTEXT, 'hotelId and module are required')
  if (!context || !text(context.hotelId)) add(reasons, ScopeReason.MISSING_CONTEXT, 'context.hotelId is required')

  if (context && expectedHotelId && text(context.hotelId) && text(context.hotelId) !== expectedHotelId) {
    add(reasons, ScopeReason.HOTEL_MISMATCH, `${context.hotelId} != ${expectedHotelId}`)
  }

  if (context && expectedSource && text(context.source) !== expectedSource) {
    add(reasons, ScopeReason.SOURCE_MISMATCH, `${text(context.source) || 'missing'} != ${expectedSource}`)
  }

  if (context && expectedVersion !== null && Number(context.version) !== Number(expectedVersion)) {
    add(reasons, ScopeReason.VERSION_MISMATCH, `${context.version ?? 'missing'} != ${expectedVersion}`)
  }

  const recordHotelId = text(record?.hotelId ?? record?.hotel_id)
  if (recordHotelId && expectedHotelId && recordHotelId !== expectedHotelId) {
    add(reasons, ScopeReason.HOTEL_MISMATCH, `${recordHotelId} != ${expectedHotelId}`)
  }

  if (requireActor && !text(context?.actor?.userId)) add(reasons, ScopeReason.MISSING_CONTEXT, 'actor.userId is required')
  if (expectedUserId && text(context?.actor?.userId) && text(context.actor.userId) !== expectedUserId) {
    add(reasons, ScopeReason.ACTOR_MISMATCH, `${context.actor.userId} != ${expectedUserId}`)
  }

  const contextView = text(context?.screen?.view)
  if (requireModule && !contextView) add(reasons, ScopeReason.MISSING_CONTEXT, 'screen.view is required')
  if (expectedModule && contextView && contextView !== expectedModule) {
    add(reasons, ScopeReason.MODULE_MISMATCH, `${contextView} != ${expectedModule}`)
  }

  const contextResourceId = text(context?.resource?.id)
  const contextResourceType = text(context?.resource?.type)
  if (requireResource && (!contextResourceId || (expectedRecordType && !contextResourceType))) {
    add(reasons, ScopeReason.MISSING_CONTEXT, 'resource type/id are required')
  }
  if (expectedRecordId && contextResourceId && contextResourceId !== expectedRecordId) {
    add(reasons, ScopeReason.RESOURCE_MISMATCH, `${contextResourceId} != ${expectedRecordId}`)
  }
  if (expectedRecordType && contextResourceType && contextResourceType !== expectedRecordType) {
    add(reasons, ScopeReason.RESOURCE_MISMATCH, `${contextResourceType} != ${expectedRecordType}`)
  }

  const recordId = text(record?.id)
  if (expectedRecordId && recordId && recordId !== expectedRecordId) {
    add(reasons, ScopeReason.RESOURCE_MISMATCH, `${recordId} != ${expectedRecordId}`)
  }

  if (permissionAllowed === false) add(reasons, ScopeReason.PERMISSION_DENIED)

  if (ownership?.required) {
    const ownerId = text(ownership.ownerId ?? record?.created_by ?? record?.createdBy ?? record?.user_id)
    const actorId = text(ownership.actorId ?? expectedUserId ?? context?.actor?.userId)
    const bypass = Boolean(ownership.bypass)
    if (!bypass && (!ownerId || !actorId || ownerId !== actorId)) add(reasons, ScopeReason.OWNERSHIP_MISMATCH)
  }

  const decision = reasons.length ? ScopeDecision.BLOCK : ScopeDecision.ALLOW
  return freeze({ decision, ok: decision === ScopeDecision.ALLOW, reasons: freeze(reasons) })
}

export function assertContextScope(input) {
  const result = evaluateContextScope(input)
  if (result.ok) return result
  const error = new Error(result.reasons.map((item) => item.reason).join(',') || 'SCOPE_GUARD_BLOCKED')
  error.code = 'SCOPE_GUARD_BLOCKED'
  error.reasons = result.reasons
  throw error
}
