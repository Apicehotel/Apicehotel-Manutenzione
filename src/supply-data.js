import { supabase } from './supabase.js'

const clean = (value) => String(value || '').trim()

export async function fetchSupplyProducts(hotelId, { includeInactive = false } = {}) {
  if (!supabase || !hotelId) return []
  let query = supabase
    .from('supply_products')
    .select('id,hotel_id,category,name,active,sort_order,created_at,updated_at')
    .eq('hotel_id', hotelId)
    .order('category')
    .order('sort_order')
    .order('name')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveSupplyProduct({ hotelId, id = null, category, name, active = true, sortOrder = 0 }) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const payload = {
    hotel_id: hotelId,
    category,
    name: clean(name),
    active: Boolean(active),
    sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    updated_at: new Date().toISOString(),
  }
  if (!payload.name) throw new Error('Inserisci il nome del prodotto')
  if (!['minibar', 'consumo'].includes(category)) throw new Error('Categoria prodotto non valida')
  const query = id
    ? supabase.from('supply_products').update(payload).eq('id', id).eq('hotel_id', hotelId)
    : supabase.from('supply_products').insert(payload)
  const { error } = await query
  if (error) throw error
}

export async function deleteSupplyProduct(hotelId, id) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { error } = await supabase.from('supply_products').delete().eq('hotel_id', hotelId).eq('id', id)
  if (error) throw error
}

export async function createSupplyRequest({ hotelId, productIds, note = '', floorContext = null }) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const uniqueIds = Array.from(new Set((productIds || []).filter(Boolean)))
  if (!uniqueIds.length) throw new Error('Seleziona almeno un prodotto')
  const { data, error } = await supabase.rpc('supply_create_request_v2', {
    p_hotel_id: hotelId,
    p_product_ids: uniqueIds,
    p_note: clean(note) || null,
    p_area_code: floorContext?.area_code || null,
    p_floor_number: Number.isFinite(Number(floorContext?.floor_number)) ? Number(floorContext.floor_number) : null,
  })
  if (error) throw error
  return data
}

export async function fetchSupplyRequests(hotelId, { limit = 40 } = {}) {
  if (!supabase || !hotelId) return []
  const { data, error } = await supabase
    .from('supply_requests')
    .select('id,hotel_id,requested_by_name,note,area_code,area_label,floor_number,floor_label,created_at,completed_at,supply_request_items(id,product_id,product_name,category,status,resolved_by_name,resolved_at)')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map((request) => ({
    ...request,
    supply_request_items: (request.supply_request_items || []).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.product_name.localeCompare(b.product_name, 'it')
    }),
  }))
}

export async function resolveSupplyItem(itemId, status) {
  if (!supabase) throw new Error('Supabase non disponibile')
  if (!['delivered', 'missing'].includes(status)) throw new Error('Stato non valido')
  const { error } = await supabase.rpc('supply_resolve_item', { p_item_id: itemId, p_status: status })
  if (error) throw error
}

export function subscribeSupplyRequests(hotelId, onChange) {
  if (!supabase || !hotelId) return () => {}
  const channel = supabase
    .channel(`supply-requests-${hotelId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_requests', filter: `hotel_id=eq.${hotelId}` }, () => onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_request_items', filter: `hotel_id=eq.${hotelId}` }, () => onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_products', filter: `hotel_id=eq.${hotelId}` }, () => onChange?.())
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
