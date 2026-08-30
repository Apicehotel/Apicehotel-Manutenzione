export const GapStatus = Object.freeze({ OPEN: 'open', PROPOSED: 'proposed', RESOLVED: 'resolved', DISMISSED: 'dismissed' })
export const GapPriority = Object.freeze({ LOW: 'low', NORMAL: 'normal', HIGH: 'high', CRITICAL: 'critical' })
export const GapScope = Object.freeze({ MAINTENANCE: 'maintenance', PROJECT: 'project', CODE: 'code', PROCEDURE: 'procedure', DOCUMENTATION: 'documentation', DECISION: 'decision' })

export function validateGap(input = {}) {
  if (!input.id) throw new TypeError('Gap id is required')
  if (!Object.values(GapStatus).includes(input.status)) throw new TypeError(`Invalid gap status: ${input.status}`)
  if (!Object.values(GapPriority).includes(input.priority)) throw new TypeError(`Invalid gap priority: ${input.priority}`)
  if (!Object.values(GapScope).includes(input.scope)) throw new TypeError(`Invalid gap scope: ${input.scope}`)
  if (!String(input.question || '').trim()) throw new TypeError('Gap question is required')
  if (input.scope === GapScope.MAINTENANCE && !input.hotelId) throw new TypeError('hotelId is required for maintenance gaps')
  return true
}
