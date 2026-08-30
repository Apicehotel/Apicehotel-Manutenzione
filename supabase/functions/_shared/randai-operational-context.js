const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max)

export function sanitizeOperationalContext(input, expectedHotelId) {
  if (!input || typeof input !== 'object') return null
  const hotelId = clean(input.hotelId || input.hotel_id, 80)
  if (!hotelId) return null
  if (expectedHotelId && hotelId !== expectedHotelId) {
    const error = new Error('context_hotel_mismatch')
    error.code = 'CONTEXT_HOTEL_MISMATCH'
    throw error
  }
  const resource = input.resource && input.resource.type === 'issue' && input.resource.id ? {
    type: 'issue',
    id: clean(input.resource.id, 120),
    location: clean(input.resource.location, 160) || null,
    category: clean(input.resource.category, 120) || null,
    status: clean(input.resource.status, 80) || null,
    urgency: clean(input.resource.urgency, 80) || null,
    summary: clean(input.resource.summary, 500) || null,
    roomStatus: clean(input.resource.roomStatus, 80) || null,
    hasPhoto: Boolean(input.resource.hasPhoto),
  } : null
  return {
    version: Number(input.version || 1),
    source: 'randapp',
    hotelId,
    screen: input.screen ? { view: clean(input.screen.view, 120) || null } : null,
    resource,
  }
}

export function buildContextQuery(query, verifiedResource = null) {
  const cleanQuery = clean(query, 1500)
  if (!verifiedResource || verifiedResource.type !== 'issue') return cleanQuery
  const context = [
    verifiedResource.location,
    verifiedResource.category,
    verifiedResource.description || verifiedResource.summary,
    verifiedResource.status,
  ].filter(Boolean).join(' · ')
  if (!context) return cleanQuery
  return `${context}. Richiesta: ${cleanQuery}`.slice(0, 1500)
}

export function clientContextSummary(context, verifiedResource = null) {
  if (!context) return null
  return {
    version: context.version || 1,
    source: 'randapp',
    hotelId: context.hotelId,
    screen: context.screen || null,
    resource: verifiedResource ? {
      type: 'issue',
      id: verifiedResource.id,
      location: verifiedResource.location || null,
      category: verifiedResource.category || null,
      status: verifiedResource.status || null,
      urgency: verifiedResource.urgency || null,
      summary: verifiedResource.description || verifiedResource.summary || null,
      hasPhoto: Boolean(verifiedResource.photo_url || verifiedResource.photo_path || verifiedResource.hasPhoto),
    } : null,
  }
}
