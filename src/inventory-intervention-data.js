import { supabase } from './supabase.js'

const clean = (value) => String(value ?? '').trim()
const requestInFlight = new Map()

const normalizePart = (row) => ({
  id: row.id,
  hotelId: row.hotel_id,
  interventionId: row.intervention_id,
  itemId: row.item_id || null,
  requestedName: row.requested_name || '',
  quantity: Number(row.quantity || 0),
  status: row.status,
  serialUnitId: row.serial_unit_id || null,
  note: row.note || '',
  movementId: row.movement_id || null,
  createdAt: row.created_at,
  reservedAt: row.reserved_at || null,
  consumedAt: row.consumed_at || null,
  releasedAt: row.released_at || null,
})

const normalizeAvailability = (row) => ({
  itemId: row.item_id,
  hotelId: row.hotel_id,
  name: row.name,
  unit: row.unit || 'pz',
  quantity: Number(row.quantity || 0),
  reservedQuantity: Number(row.reserved_quantity || 0),
  availableQuantity: Number(row.available_quantity || 0),
})

function readableError(error) {
  const text = String(error?.message || error || '')
  if (text.includes('INSUFFICIENT_AVAILABLE_STOCK')) return new Error('Quantità non disponibile: una parte della giacenza è già prenotata per altri interventi.')
  if (text.includes('INSUFFICIENT_STOCK')) return new Error('Giacenza insufficiente per confermare l’uso del ricambio.')
  if (text.includes('SERIAL_ALREADY_RESERVED')) return new Error('Questa unità serializzata è già prenotata per un altro intervento.')
  if (text.includes('SERIAL_NOT_AVAILABLE')) return new Error('Questa unità serializzata non è disponibile.')
  if (text.includes('PART_NOT_RESERVED')) return new Error('Il ricambio deve essere prenotato prima di poterlo segnare come usato.')
  if (text.includes('INTERVENTION_PARTS_PENDING')) return new Error('Prima di chiudere l’intervento risolvi tutti i ricambi richiesti o prenotati.')
  if (text.includes('PERMISSION_DENIED')) return new Error('Non hai il permesso necessario per gestire i ricambi di questo intervento.')
  return error instanceof Error ? error : new Error(text || 'Operazione non riuscita')
}

function requireScope(scope = {}) {
  const hotelId = clean(scope.hotelId)
  const interventionId = clean(scope.interventionId)
  if (!hotelId || !interventionId) throw new TypeError('hotelId e interventionId sono obbligatori')
  return { hotelId, interventionId }
}

export async function fetchInterventionParts(scope) {
  if (!supabase) return []
  const { hotelId, interventionId } = requireScope(scope)
  const { data, error } = await supabase.from('inventory_intervention_parts').select('*').eq('hotel_id', hotelId).eq('intervention_id', interventionId).order('created_at')
  if (error) throw readableError(error)
  return (data || []).map(normalizePart)
}

export async function fetchInventoryAvailability(hotelId) {
  if (!supabase || !hotelId) return []
  const { data, error } = await supabase.from('inventory_available_stock').select('*').eq('hotel_id', hotelId).order('name')
  if (error) throw readableError(error)
  return (data || []).map(normalizeAvailability)
}

export async function requestInterventionPart(interventionId, draft = {}) {
  if (!supabase) throw new Error('Supabase non disponibile')
  if (!interventionId) throw new TypeError('interventionId è obbligatorio')
  const args = {
    p_intervention_id: interventionId,
    p_item_id: draft.itemId || null,
    p_requested_name: clean(draft.requestedName) || null,
    p_quantity: Number(draft.quantity || 1),
    p_note: clean(draft.note) || null,
    p_reserve: draft.reserve !== false,
    p_serial_unit_id: draft.serialUnitId || null,
  }
  const key = JSON.stringify(args)
  if (requestInFlight.has(key)) return requestInFlight.get(key)
  const operation = (async () => {
    const { data, error } = await supabase.rpc('inventory_request_intervention_part', args)
    if (error) throw readableError(error)
    return normalizePart(data)
  })()
  requestInFlight.set(key, operation)
  try { return await operation } finally { if (requestInFlight.get(key) === operation) requestInFlight.delete(key) }
}

export async function reserveInterventionPart(partId, itemId, serialUnitId = null) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { data, error } = await supabase.rpc('inventory_reserve_intervention_part', { p_part_id: partId, p_item_id: itemId || null, p_serial_unit_id: serialUnitId || null })
  if (error) throw readableError(error)
  return normalizePart(data)
}

export async function releaseInterventionPart(partId, { cancel = false } = {}) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { data, error } = await supabase.rpc('inventory_release_intervention_part', { p_part_id: partId, p_cancel: Boolean(cancel) })
  if (error) throw readableError(error)
  return normalizePart(data)
}

export async function consumeInterventionPart(partId) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { data, error } = await supabase.rpc('inventory_consume_intervention_part', { p_part_id: partId })
  if (error) throw readableError(error)
  return normalizePart(data)
}

export async function fetchAvailableSerialUnits({ hotelId, itemId } = {}) {
  if (!supabase || !hotelId || !itemId) return []
  const { data, error } = await supabase.from('inventory_serial_units').select('id,serial_number,asset_tag,barcode,status,condition').eq('hotel_id', hotelId).eq('item_id', itemId).eq('active', true).eq('status', 'available').order('serial_number')
  if (error) throw readableError(error)
  return (data || []).map((row) => ({ id: row.id, serialNumber: row.serial_number, assetTag: row.asset_tag || '', barcode: row.barcode || '', status: row.status, condition: row.condition }))
}

export function subscribeInterventionParts(scope, onChange) {
  if (!supabase) return () => {}
  const { hotelId, interventionId } = requireScope(scope)
  const guardedChange = (payload) => {
    const rowHotel = payload?.new?.hotel_id || payload?.old?.hotel_id
    if (rowHotel && rowHotel !== hotelId) return
    onChange?.(payload)
  }
  const channel = supabase.channel(`inventory-intervention-${hotelId}-${interventionId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_intervention_parts', filter: `intervention_id=eq.${interventionId}` }, guardedChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
