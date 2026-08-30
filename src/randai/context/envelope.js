const EVENT = 'randai-context-changed'
const VERSION = 1

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max)
const clone = (value) => value == null ? value : structuredClone(value)

function normalizeResource(resource) {
  if (!resource || resource.type !== 'issue') return null
  const id = clean(resource.id, 120)
  if (!id) return null
  return {
    type: 'issue',
    id,
    location: clean(resource.location, 160) || null,
    category: clean(resource.category, 120) || null,
    status: clean(resource.status, 80) || null,
    urgency: clean(resource.urgency, 80) || null,
    summary: clean(resource.summary, 500) || null,
    roomStatus: clean(resource.roomStatus, 80) || null,
    hasPhoto: Boolean(resource.hasPhoto),
  }
}

export function createRandAIContextEnvelope({ hotelId, actor = null, screen = null, resource = null } = {}) {
  const hotel = clean(hotelId, 80)
  if (!hotel) return null
  return {
    version: VERSION,
    source: 'randapp',
    hotelId: hotel,
    actor: actor ? {
      userId: clean(actor.userId, 120) || null,
      legacyId: clean(actor.legacyId, 120) || null,
      role: clean(actor.role, 120) || null,
      department: clean(actor.department, 120) || null,
    } : null,
    screen: screen ? {
      view: clean(screen.view, 120) || null,
    } : null,
    resource: normalizeResource(resource),
    updatedAt: new Date().toISOString(),
  }
}

export function createIssueContextEnvelope({ hotelId, issue, actor = null } = {}) {
  if (!issue) return createRandAIContextEnvelope({ hotelId, actor, screen: { view: 'issues' } })
  return createRandAIContextEnvelope({
    hotelId,
    actor,
    screen: { view: 'issues' },
    resource: {
      type: 'issue',
      id: issue.id,
      location: issue.room || issue.location,
      category: issue.category,
      status: issue.status,
      urgency: issue.urgency,
      summary: issue.title || issue.description,
      roomStatus: issue.roomStatus,
      hasPhoto: Boolean(issue.photoData || issue.photoPath),
    },
  })
}

let current = null

export function publishRandAIContext(envelope) {
  current = envelope ? clone(envelope) : null
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: clone(current) }))
  return clone(current)
}

export function getRandAIContext() {
  return clone(current)
}

export function subscribeRandAIContext(listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => listener(clone(event.detail || null))
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

export function clearRandAIContextResource({ hotelId, resourceId } = {}) {
  if (!current) return null
  if (hotelId && current.hotelId !== hotelId) return clone(current)
  if (resourceId && current.resource?.id !== resourceId) return clone(current)
  current = { ...current, resource: null, updatedAt: new Date().toISOString() }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: clone(current) }))
  return clone(current)
}

export const RANDAI_CONTEXT_EVENT = EVENT
export const RANDAI_CONTEXT_VERSION = VERSION
