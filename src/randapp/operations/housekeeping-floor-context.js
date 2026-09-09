const text = (value) => value == null ? '' : String(value).trim()

function normalizeFloor(value) {
  const floorId = text(value)
  return floorId || null
}

export function createHousekeepingFloorContext({
  hotelId,
  assignedFloors = [],
  selectedFloor = null,
  role = 'housekeeper',
  canChangeFloor = false,
} = {}) {
  const normalizedHotelId = text(hotelId)
  if (!normalizedHotelId) throw new TypeError('Housekeeping floor context requires hotelId')

  const floors = [...new Set((Array.isArray(assignedFloors) ? assignedFloors : [])
    .map(normalizeFloor)
    .filter(Boolean))]

  const requestedFloor = normalizeFloor(selectedFloor)
  const initialFloor = requestedFloor ?? floors[0] ?? null

  if (initialFloor && floors.length > 0 && !floors.includes(initialFloor)) {
    throw new Error('Selected housekeeping floor must belong to the assigned floor set')
  }

  return Object.freeze({
    version: 'HOUSEKEEPING_FLOOR_CONTEXT_V1',
    hotelId: normalizedHotelId,
    assignedFloors: Object.freeze(floors),
    selectedFloor: initialFloor,
    role: text(role) || 'housekeeper',
    canChangeFloor: Boolean(canChangeFloor),
    hotelLocked: true,
  })
}

export function changeHousekeepingFloor(context, nextFloor, { hotelId } = {}) {
  if (!context || context.version !== 'HOUSEKEEPING_FLOOR_CONTEXT_V1') throw new TypeError('Valid housekeeping floor context required')
  const requestedHotelId = text(hotelId || context.hotelId)
  if (requestedHotelId !== context.hotelId) throw new Error('Housekeeping floor change cannot switch hotel')
  if (!context.canChangeFloor) throw new Error('Housekeeping floor change is not allowed for this user')

  const normalizedFloor = normalizeFloor(nextFloor)
  if (!normalizedFloor) throw new TypeError('Target housekeeping floor required')
  if (context.assignedFloors.length > 0 && !context.assignedFloors.includes(normalizedFloor)) {
    throw new Error('Target housekeeping floor is outside the assigned floor set')
  }

  return Object.freeze({ ...context, selectedFloor: normalizedFloor })
}

export function buildHousekeepingIssueDraft(context, { locationId, description, category = 'housekeeping' } = {}) {
  if (!context || context.version !== 'HOUSEKEEPING_FLOOR_CONTEXT_V1') throw new TypeError('Valid housekeeping floor context required')
  const normalizedLocation = text(locationId)
  const normalizedDescription = text(description)
  if (!normalizedDescription) throw new TypeError('Housekeeping issue description required')

  return Object.freeze({
    source: 'HOUSEKEEPING',
    hotelId: context.hotelId,
    floor: context.selectedFloor,
    locationId: normalizedLocation || null,
    category: text(category) || 'housekeeping',
    description: normalizedDescription,
    persistenceOwner: 'ISSUES',
    requiresExistingIssueAuthorization: true,
  })
}
