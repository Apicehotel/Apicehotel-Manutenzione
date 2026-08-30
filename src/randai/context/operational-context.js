const EVENT = 'randai-operational-context-changed'
const VERSION = 1
const MAX_TEXT = 600

let current = null

function cleanText(value, max = MAX_TEXT) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text ? text.slice(0, max) : null
}

function cleanId(value) {
  const text = cleanText(value, 160)
  return text && /^[a-zA-Z0-9._:-]+$/.test(text) ? text : null
}

export function buildOperationalContext(input = {}) {
  const hotelId = cleanId(input.hotelId)
  if (!hotelId) return null

  const resourceType = cleanId(input.resource?.type)
  const resourceId = cleanId(input.resource?.id)
  const resource = resourceType && resourceId ? {
    type: resourceType,
    id: resourceId,
    location: cleanText(input.resource?.location, 180),
    category: cleanText(input.resource?.category, 120),
    status: cleanText(input.resource?.status, 80),
    summary: cleanText(input.resource?.summary),
  } : null

  const view = cleanId(input.view) || null
  const queryHint = cleanText(input.queryHint || [resource?.location, resource?.category, resource?.summary].filter(Boolean).join(' · '), 1000)

  return Object.freeze({
    version: VERSION,
    hotelId,
    view,
    resource,
    queryHint,
    source: cleanId(input.source) || 'randapp',
    createdAt: Date.now(),
  })
}

export function publishOperationalContext(input) {
  const envelope = buildOperationalContext(input)
  if (!envelope) return null
  current = envelope
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: envelope }))
  return envelope
}

export function clearOperationalContext({ hotelId, resourceType, resourceId } = {}) {
  if (!current) return false
  if (hotelId && current.hotelId !== hotelId) return false
  if (resourceType && current.resource?.type !== resourceType) return false
  if (resourceId && current.resource?.id !== resourceId) return false
  current = null
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: null }))
  return true
}

export function getOperationalContext({ hotelId } = {}) {
  if (!current) return null
  if (hotelId && current.hotelId !== hotelId) return null
  return current
}

export function subscribeOperationalContext(listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => listener(event.detail || null)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

export function contextQueryHint(context) {
  if (!context?.queryHint) return ''
  return String(context.queryHint).trim().slice(0, 1000)
}

export const OPERATIONAL_CONTEXT_EVENT = EVENT
export const OPERATIONAL_CONTEXT_VERSION = VERSION
