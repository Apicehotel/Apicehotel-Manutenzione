import { supabase } from './supabase.js'
import { normalizeLayoutDocument, validateLayoutDocument } from './randsale2d-model.js'

const fromRow = row => row ? { bookingId: row.booking_id, hotelId: row.hotel_id, version: row.version, document: normalizeLayoutDocument(row.document), updatedAt: row.updated_at, updatedBy: row.updated_by } : null

export async function fetchSaleLayoutSnapshot(bookingId, hotelId) {
  if (!supabase || !bookingId || String(bookingId).startsWith('offline-')) return null
  const { data, error } = await supabase.from('sale_layout_snapshots').select('*').eq('booking_id', bookingId).eq('hotel_id', hotelId).maybeSingle()
  if (error) throw error
  return fromRow(data)
}

export async function saveSaleLayoutSnapshot({ bookingId, hotelId, document, expectedVersion = 0 }) {
  if (!supabase) throw new Error('Il salvataggio della pianta richiede una connessione')
  const checked = validateLayoutDocument(document)
  if (!checked.valid) throw new Error(checked.issues[0])
  const { data, error } = await supabase.rpc('save_sale_layout_snapshot', { p_booking_id: bookingId, p_hotel_id: hotelId, p_document: checked.document, p_expected_version: expectedVersion })
  if (error) throw error
  return fromRow(Array.isArray(data) ? data[0] : data)
}
