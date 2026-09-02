export const ControlSection = Object.freeze({ ACTIVE:'ACTIVE', ATTENTION:'ATTENTION', PROPOSALS:'PROPOSALS', BLOCKED:'BLOCKED', COMPLETED:'COMPLETED' })

export function classifyControlItem(item={}) {
  const status=String(item.status||'')
  if(['RUNNING','PLANNED','ACTIONED'].includes(status)) return ControlSection.ACTIVE
  if(['BLOCKED','NEEDS_REVIEW','PENDING'].includes(status)) return ControlSection.BLOCKED
  if(['PROPOSED','RECOMMENDED'].includes(status)) return ControlSection.PROPOSALS
  if(['SUCCEEDED','RESOLVED','COMPLETED','PASSED'].includes(status)) return ControlSection.COMPLETED
  return ControlSection.ATTENTION
}

export function normalizeControlScope({ hotelId = null, allHotels = false } = {}) {
  const scopedHotel = String(hotelId || '').trim() || null
  if (scopedHotel && allHotels) throw new TypeError('Control Center scope cannot be both one hotel and allHotels')
  if (!scopedHotel && !allHotels) throw new TypeError('Control Center requires hotelId or explicit allHotels:true')
  return { hotelId: scopedHotel, allHotels: Boolean(allHotels) }
}

export function controlItemMatchesScope(item = {}, scope = {}) {
  if (scope.allHotels) return true
  return String(item.hotelId || item.hotel_id || item.scope?.hotelId || '').trim() === scope.hotelId
}
