import { supabase } from './supabase.js'

const fromRow = (row) => ({
  hotelId: row.hotel_id,
  key: row.room_key,
  name: row.name,
  family: row.family,
  parts: Array.isArray(row.parts) ? row.parts : [],
  active: row.active !== false,
  sortOrder: row.sort_order ?? 0,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
})

const toRow = (room) => ({
  hotel_id: room.hotelId,
  room_key: room.key,
  name: room.name,
  family: room.family || room.name,
  parts: room.parts || [],
  active: room.active !== false,
  sort_order: room.sortOrder ?? 0,
})

export async function fetchSaleRooms(hotelId, { includeInactive = false } = {}) {
  if (!supabase) return []
  let query = supabase.from('sale_rooms_config').select('*').eq('hotel_id', hotelId).order('sort_order', { ascending: true }).order('name', { ascending: true })
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function saveSaleRoom(room) {
  const { data, error } = await supabase.from('sale_rooms_config').upsert(toRow(room), { onConflict: 'hotel_id,room_key' }).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function setSaleRoomActive(hotelId, key, active) {
  const { data, error } = await supabase.from('sale_rooms_config').update({ active }).eq('hotel_id', hotelId).eq('room_key', key).select().single()
  if (error) throw error
  return fromRow(data)
}

export function subscribeSaleRooms(hotelId, onChange) {
  if (!supabase) return () => {}
  const topic = `sale-rooms-${hotelId}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
  const channel = supabase.channel(topic).on('postgres_changes', { event: '*', schema: 'public', table: 'sale_rooms_config', filter: `hotel_id=eq.${hotelId}` }, onChange).subscribe()
  return () => supabase.removeChannel(channel)
}
