export const KnowledgeTrust = Object.freeze({ DRAFT: 'DRAFT', VERIFIED: 'VERIFIED', APPROVED: 'APPROVED', AI_SUGGESTION: 'AI_SUGGESTION', OUTDATED: 'OUTDATED', UNKNOWN: 'UNKNOWN' })
export const KnowledgeKind = Object.freeze({ EQUIPMENT: 'EQUIPMENT', LOCATION: 'LOCATION', PROCEDURE: 'PROCEDURE', DOCUMENT: 'DOCUMENT', FACT: 'FACT' })
export const RelationType = Object.freeze({ SERVES: 'SERVES', LOCATED_IN: 'LOCATED_IN', CONNECTED_TO: 'CONNECTED_TO', REQUIRES: 'REQUIRES', RELATED_TO: 'RELATED_TO' })

export function assertHotelScope(record) {
  if (!record?.hotelId) throw new TypeError('hotelId is required')
  return record
}

export function normalizeText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}
