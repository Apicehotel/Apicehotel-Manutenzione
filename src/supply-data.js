import { supabase } from './supabase.js'
import { callSupplyApi } from './supply-api.js'
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
    const { data } = await callSupplyApi('list-products', {
      hotel_id: hotelId,
      include_inactive: Boolean(includeInactive),
    })
    const rows = data || []
    await setCachedCollection(PRODUCTS_ENTITY, hotelId, rows)
    return activeProducts(rows, includeInactive)
  } catch (error) {
    const cached = activeProducts(await getCachedCollection(PRODUCTS_ENTITY, hotelId), includeInactive)
    if (cached.length || isTransientNetworkError(error)) return cached
    throw error
  }
}

export async function saveSupplyProduct({ hotelId, id = null, category, name, active = true, sortOrder = 0 }) {
  if (!supabase || !onlineNow()) throw new Error('La gestione prodotti richiede una connessione internet')
  const cleanName = clean(name)
  if (!cleanName) throw new Error('Inserisci il nome del prodotto')
  if (!['minibar', 'consumo'].includes(category)) throw new Error('Categoria prodotto non valida')
  await callSupplyApi('save-product', {
    hotel_id: hotelId,
    id,
    category,
    name: cleanName,
    active: Boolean(active),
    sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
  })
  await fetchSupplyProducts(hotelId, { includeInactive: true }).catch(() => {})
}

export async function deleteSupplyProduct(hotelId, id) {
  if (!supabase || !onlineNow()) throw new Error('La gestione prodotti richiede una connessione internet')
  await callSupplyApi('delete-product', { hotel_id: hotelId, id })
  await fetchSupplyProducts(hotelId, { includeInactive: true }).catch(() => {})
}

export async function createSupplyRequest({ hotelId, productIds, note = '', floorContext = null }) {
  if (!supabase || !onlineNow()) throw new Error('L’invio della richiesta richiede una connessione internet')
  const uniqueIds = Array.from(new Set((productIds || []).filter(Boolean)))
  if (!uniqueIds.length) throw new Error('Seleziona almeno un prodotto')
  const { id } = await callSupplyApi('create-request', {
    hotel_id: hotelId,
    product_ids: uniqueIds,
    note: clean(note) || null,
    area_code: floorContext?.area_code || null,
    floor_number: Number.isFinite(Number(floorContext?.floor_number)) ? Number(floorContext.floor_number) : null,
  })
  await fetchSupplyRequests(hotelId).catch(() => {})
  return id
}

export async function fetchSupplyRequests(hotelId, { limit = 40 } = {}) {
  if (!hotelId) return []
  const cachedRows = async () => (await getCachedCollection(REQUESTS_ENTITY, hotelId)).slice(0, limit)
  if (!supabase || !onlineNow()) return cachedRows()
  try {
    const { data } = await callSupplyApi('list-requests', { hotel_id: hotelId, limit })
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
  await callSupplyApi('resolve-item', { item_id: itemId, status })
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
