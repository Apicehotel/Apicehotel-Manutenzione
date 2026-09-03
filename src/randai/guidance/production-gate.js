import { canonicalizeProcedure, isProcedurePublishable } from './catalog.js'

export function evaluateRandGuideReadiness({ procedures = [], equipment = [], documents = [], sessions = [], graph = null } = {}) {
  const reasons = []
  const approved = procedures.filter((item) => item.status === 'approved')
  const scopedHotels = new Set(procedures.map((item) => item.hotel_id || item.hotelId).filter(Boolean))
  const invalid = []
  for (const item of approved) {
    try {
      const gate = isProcedurePublishable(canonicalizeProcedure(item))
      if (!gate.publishable) invalid.push({ id:item.id, blockers:gate.blockers })
    } catch (error) { invalid.push({ id:item?.id || null, blockers:['INVALID_CONTRACT'] }) }
  }
  if (!approved.length) reasons.push('NO_APPROVED_PROCEDURES')
  if (invalid.length) reasons.push('UNPUBLISHABLE_APPROVED_PROCEDURES')
  if (scopedHotels.size && [...scopedHotels].some((hotelId) => !['hotelgio','chocohotel','brigantino'].includes(hotelId))) reasons.push('UNKNOWN_HOTEL_SCOPE')
  if (!Array.isArray(equipment)) reasons.push('EQUIPMENT_SOURCE_MISSING')
  if (!Array.isArray(documents)) reasons.push('DOCUMENT_SOURCE_MISSING')
  if (!Array.isArray(sessions)) reasons.push('GUIDANCE_SESSION_SOURCE_MISSING')
  if (graph && graph.hotelId && graph.nodes?.some((node) => node.hotelId !== graph.hotelId)) reasons.push('CROSS_HOTEL_GRAPH_LEAK')
  const completedSessions = sessions.filter((item) => item.status === 'COMPLETED').length
  return Object.freeze({
    ready:reasons.length === 0,
    status:reasons.length ? 'BLOCKED' : 'READY',
    reasons:Object.freeze(reasons),
    metrics:Object.freeze({ approvedProcedures:approved.length, invalidApproved:invalid.length, equipment:equipment.length, documents:documents.length, sessions:sessions.length, completedSessions, hotels:scopedHotels.size }),
  })
}

export function assertRandGuideReady(input) {
  const result = evaluateRandGuideReadiness(input)
  if (!result.ready) throw new Error(`RandGuide not ready:${result.reasons.join(',')}`)
  return result
}
