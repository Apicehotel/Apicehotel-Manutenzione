const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max)
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

const PART_STATUSES = new Set(['requested', 'reserved', 'consumed', 'released', 'cancelled'])
const MAX_PARTS = 20

export function buildWarehouseEvidence({ hotelId, parts = [], items = [], availability = [] } = {}) {
  const hotel = clean(hotelId, 80)
  if (!hotel) return null

  const itemById = new Map((Array.isArray(items) ? items : [])
    .filter((item) => item?.id && (!item.hotelId || item.hotelId === hotel))
    .map((item) => [item.id, item]))
  const availabilityById = new Map((Array.isArray(availability) ? availability : [])
    .filter((row) => row?.itemId && (!row.hotelId || row.hotelId === hotel))
    .map((row) => [row.itemId, row]))

  const normalizedParts = (Array.isArray(parts) ? parts : [])
    .filter((part) => part?.id && (!part.hotelId || part.hotelId === hotel))
    .slice(0, MAX_PARTS)
    .map((part) => {
      const item = part.itemId ? itemById.get(part.itemId) : null
      const stock = part.itemId ? availabilityById.get(part.itemId) : null
      const availableQuantity = stock ? num(stock.availableQuantity) : null
      const minimumQuantity = item ? num(item.minQuantity) : null
      return {
        id: clean(part.id, 120),
        itemId: clean(part.itemId, 120) || null,
        name: clean(item?.name || part.requestedName || 'Ricambio', 180),
        sku: clean(item?.sku, 100) || null,
        status: PART_STATUSES.has(part.status) ? part.status : 'requested',
        quantity: num(part.quantity),
        unit: clean(item?.unit || stock?.unit || 'pz', 24),
        availableQuantity,
        minimumQuantity,
        lowStock: availableQuantity != null && minimumQuantity != null ? availableQuantity <= minimumQuantity : null,
        serialLinked: Boolean(part.serialUnitId),
        movementLinked: Boolean(part.movementId),
      }
    })

  return {
    source: 'inventory_intervention_parts',
    trust: 'operational_db',
    readOnly: true,
    hotelId: hotel,
    bounded: normalizedParts.length < (Array.isArray(parts) ? parts.length : 0),
    pendingCount: normalizedParts.filter((part) => part.status === 'requested' || part.status === 'reserved').length,
    reservedCount: normalizedParts.filter((part) => part.status === 'reserved').length,
    consumedCount: normalizedParts.filter((part) => part.status === 'consumed').length,
    parts: normalizedParts,
  }
}

export const RANDAI_WAREHOUSE_EVIDENCE_MAX_PARTS = MAX_PARTS
