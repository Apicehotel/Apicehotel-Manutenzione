const text = (value, max = 240) => String(value ?? '').trim().slice(0, max)
const clone = (value) => value == null ? value : structuredClone(value)
const freeze = (value) => Object.freeze(value)

export const OperationalContextScope = freeze({ HOTEL: 'hotel', GLOBAL: 'global' })

function normalizeResource(resource) {
  if (!resource) return null
  const type = text(resource.type, 80)
  const id = text(resource.id, 120)
  if (!type || !id) return null
  return freeze({
    type,
    id,
    hotelId: text(resource.hotelId ?? resource.hotel_id, 80) || null,
    location: text(resource.location, 160) || null,
    category: text(resource.category, 120) || null,
    status: text(resource.status, 80) || null,
    summary: text(resource.summary, 500) || null,
  })
}

export function createOperationalContext({
  hotelId = null,
  global = false,
  actor = null,
  screen = null,
  resource = null,
  permissions = [],
  evidence = [],
  attachments = [],
  metadata = {},
  updatedAt = null,
} = {}) {
  const hotel = text(hotelId, 80) || null
  if (Boolean(global) === Boolean(hotel)) {
    throw new TypeError('operational context requires exactly one scope: hotelId or global:true')
  }
  const userId = text(actor?.userId, 120) || null
  if (!global && !userId) throw new TypeError('hotel-scoped operational context requires actor.userId')
  if (!Array.isArray(permissions) || !Array.isArray(evidence) || !Array.isArray(attachments)) {
    throw new TypeError('permissions, evidence and attachments must be arrays')
  }

  const normalizedResource = normalizeResource(resource)
  if (normalizedResource?.hotelId && hotel && normalizedResource.hotelId !== hotel) {
    throw new TypeError('resource hotel scope does not match operational context')
  }

  return freeze({
    version: 1,
    scope: global ? OperationalContextScope.GLOBAL : OperationalContextScope.HOTEL,
    global: Boolean(global),
    hotelId: hotel,
    actor: actor ? freeze({
      userId,
      role: text(actor.role, 120) || null,
      department: text(actor.department, 120) || null,
    }) : null,
    screen: screen ? freeze({ view: text(screen.view, 120) || null }) : null,
    resource: normalizedResource,
    permissions: freeze([...new Set(permissions.map((item) => text(item, 160)).filter(Boolean))]),
    evidence: freeze(evidence.map(clone)),
    attachments: freeze(attachments.map(clone)),
    metadata: freeze({ ...(metadata || {}) }),
    updatedAt: text(updatedAt, 80) || new Date().toISOString(),
  })
}

export function assertOperationalContext(context, { requireResource = false, permission = null } = {}) {
  if (!context || typeof context !== 'object') throw new TypeError('operational context is required')
  const hotel = text(context.hotelId, 80)
  if (Boolean(context.global) === Boolean(hotel)) throw new TypeError('operational context scope is invalid')
  if (!context.global && !text(context.actor?.userId, 120)) throw new TypeError('actor.userId is required')
  if (requireResource && (!text(context.resource?.type, 80) || !text(context.resource?.id, 120))) {
    throw new TypeError('resource type/id are required')
  }
  if (hotel && text(context.resource?.hotelId, 80) && text(context.resource.hotelId, 80) !== hotel) {
    throw new TypeError('resource hotel scope does not match operational context')
  }
  if (permission && !context.permissions?.includes(permission)) {
    const error = new Error(`permission denied: ${permission}`)
    error.code = 'OPERATIONAL_CONTEXT_PERMISSION_DENIED'
    throw error
  }
  return context
}
