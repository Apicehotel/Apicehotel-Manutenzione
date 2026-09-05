import { supabase } from './supabase.js'

const STORAGE_PREFIX = 'apicehotel.operational-floor-context.v1'
const clean = (value) => String(value || '').trim()

const userStorageKey = (user) => clean(
  user?.auth_user_id || user?.authUserId || user?.id || user?.username || user?.name || user?.display_name || 'shared',
)

export const floorContextId = (context) => context
  ? `${clean(context.area_code)}:${Number(context.floor_number)}`
  : ''

export async function fetchOperationalFloorContexts(hotelId) {
  if (!supabase || !hotelId) return []
  const { data, error } = await supabase.rpc('operational_list_floor_contexts', { p_hotel_id: hotelId })
  if (error) throw error
  return (data || []).map((row) => ({
    area_code: clean(row.area_code).toLowerCase(),
    area_label: clean(row.area_label),
    floor_number: Number(row.floor_number),
    floor_label: clean(row.floor_label),
    sort_order: Number(row.sort_order) || 0,
  })).filter((row) => row.area_code && row.area_label && Number.isFinite(row.floor_number) && row.floor_label)
}

export function operationalFloorStorageKey(user, hotelId) {
  return `${STORAGE_PREFIX}:${userStorageKey(user)}:${clean(hotelId)}`
}

export function loadOperationalFloorContext(user, hotelId, contexts = []) {
  if (!hotelId || !contexts.length) return null
  if (contexts.length === 1) return contexts[0]
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const stored = JSON.parse(window.localStorage.getItem(operationalFloorStorageKey(user, hotelId)) || 'null')
    const storedId = floorContextId(stored)
    return contexts.find((context) => floorContextId(context) === storedId) || null
  } catch {
    return null
  }
}

export function saveOperationalFloorContext(user, hotelId, context) {
  if (!hotelId || !context || typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(operationalFloorStorageKey(user, hotelId), JSON.stringify({
      area_code: clean(context.area_code).toLowerCase(),
      area_label: clean(context.area_label),
      floor_number: Number(context.floor_number),
      floor_label: clean(context.floor_label),
    }))
  } catch {
    // localStorage può essere disabilitato: il contesto resta valido per la sessione React.
  }
}
