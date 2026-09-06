import { supabase } from './supabase.js'
import { getCachedCollection, isTransientNetworkError, setCachedCollection } from './offline-store.js'

const clean = (value) => String(value || '').trim()
const onlineNow = () => typeof navigator === 'undefined' || navigator.onLine
const PRODUCTS_ENTITY = 'supply-products'
const REQUESTS_ENTITY = 'supply-requests'
const activeProducts = (items, includeInactive) => includeInactive ? items : (items || []).filter((item) => item.active !== false)

export async function fetchSupplyProducts(hotelId, { includeInactive = false } = {}) {
  if (!hotelId) return []
  if (!supabase || !onlineNow()) return activeProducts(await getCachedCollection(PRODUCTS_ENTITY, hotelId), includeInactive)
  try {
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
    const rows = data || []
    await setCachedCollection(PRODUCTS_ENTITY, hotelId, rows)
    return rows
  } catch (error) {
    const cached = activeProducts(await getCachedCollection(PRODUCTS_ENTITY, hotelId), includeInactive)
    if (cached.length || isTransientNetworkError(error)) return cached
    throw error
  }
}

export async function saveSupplyProduct({ hotelId, id = null, category, name, active = true, sortOrder = 0 }) {
  if (!supabase || !onlineNow()) throw new Error('La gestione prodotti richiede una connessione internet')
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
  await fetchSupplyProducts(hotelId, { includeInactive: true }).catch(() => {})
}

export async function deleteSupplyProduct(hotelId, id) {
  if (!supabase || !onlineNow()) throw new Error('La gestione prodotti richiede una connessione internet')
  const { error } = await supabase.from('supply_products').delete().eq('hotel_id', hotelId).eq('id', id)
  if (error) throw error
  await fetchSupplyProducts(hotelId, { includeInactive: true }).catch(() => {})
}

export async function createSupplyRequest({ hotelId, productIds, note = '', floorContext = null }) {
  if (!supabase || !onlineNow()) throw new Error('L’invio della richiesta richiede una connessione internet')
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
  await fetchSupplyRequests(hotelId).catch(() => {})
  return data
}

export async function fetchSupplyRequests(hotelId, { limit = 40 } = {}) {
  if (!hotelId) return []
  const cachedRows = async () => (await getCachedCollection(REQUESTS_ENTITY, hotelId)).slice(0, limit)
  if (!supabase || !onlineNow()) return cachedRows()
  try {
    const { data, error } = await supabase
      .from('supply_requests')
      .select('id,hotel_id,requested_by_name,note,area_code,area_label,floor_number,floor_label,created_at,completed_at,supply_request_items(id,product_id,product_name,category,status,resolved_by_name,resolved_at)')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    const rows = (data || []).map((request) => ({
      ...request,
      supply_request_items: (request.supply_request_items || []).sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category)
        return a.product_name.localeCompare(b.product_name, 'it')
      }),
    }))
    await setCachedCollection(REQUESTS_ENTITY, hotelId, rows)
    return rows
  } catch (error) {
    const cached = await cachedRows()
    if (cached.length || isTransientNetworkError(error)) return cached
    throw error
  }
}

export async function resolveSupplyItem(itemId, status) {
  if (!supabase || !onlineNow()) throw new Error('La conferma della consegna richiede una connessione internet')
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
