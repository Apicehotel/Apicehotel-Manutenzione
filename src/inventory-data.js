import { supabase } from './supabase.js'

function normalizeItem(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    name: row.name,
    category: row.category || 'Varie',
    unit: row.unit || 'pz',
    location: row.location || '',
    sku: row.sku || '',
    quantity: Number(row.quantity || 0),
    minQuantity: Number(row.min_quantity || 0),
    notes: row.notes || '',
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeMovement(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    itemId: row.item_id,
    delta: Number(row.delta || 0),
    before: Number(row.quantity_before || 0),
    after: Number(row.quantity_after || 0),
    note: row.note || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  }
}

export async function fetchInventoryItems(hotelId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('active', true)
    .order('category')
    .order('name')
  if (error) throw error
  return (data || []).map(normalizeItem)
}

export async function createInventoryItem(hotelId, draft) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const payload = {
    hotel_id: hotelId,
    name: draft.name.trim(),
    category: draft.category.trim() || 'Varie',
    unit: draft.unit.trim() || 'pz',
    location: draft.location.trim() || null,
    sku: draft.sku.trim() || null,
    quantity: Number(draft.quantity || 0),
    min_quantity: Number(draft.minQuantity || 0),
    notes: draft.notes.trim() || null,
  }
  const { data, error } = await supabase.from('inventory_items').insert(payload).select('*').single()
  if (error) throw error
  return normalizeItem(data)
}

export async function updateInventoryItem(id, hotelId, changes) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const payload = {}
  if ('name' in changes) payload.name = changes.name.trim()
  if ('category' in changes) payload.category = changes.category.trim() || 'Varie'
  if ('unit' in changes) payload.unit = changes.unit.trim() || 'pz'
  if ('location' in changes) payload.location = changes.location.trim() || null
  if ('sku' in changes) payload.sku = changes.sku.trim() || null
  if ('minQuantity' in changes) payload.min_quantity = Number(changes.minQuantity || 0)
  if ('notes' in changes) payload.notes = changes.notes.trim() || null
  if ('active' in changes) payload.active = Boolean(changes.active)
  payload.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('inventory_items').update(payload).eq('id', id).eq('hotel_id', hotelId).select('*').single()
  if (error) throw error
  return normalizeItem(data)
}

export async function adjustInventoryStock(itemId, delta, note = '') {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { data, error } = await supabase.rpc('inventory_adjust_stock', {
    p_item_id: itemId,
    p_delta: Number(delta),
    p_note: note || null,
  })
  if (error) throw error
  return normalizeItem(data)
}

export async function fetchInventoryMovements(itemId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []).map(normalizeMovement)
}

export function subscribeInventory(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`inventory-${hotelId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
