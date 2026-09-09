import { supabase } from './supabase.js'
import { normalizeLayoutDocument, validateLayoutDocument } from './randsale2d-model.js'

const fromRow = row => row ? { bookingId: row.booking_id, hotelId: row.hotel_id, version: row.version, document: normalizeLayoutDocument(row.document), updatedAt: row.updated_at, updatedBy: row.updated_by } : null
const fromHistoryRow = row => row ? { id: row.id, bookingId: row.booking_id, hotelId: row.hotel_id, version: row.version, document: normalizeLayoutDocument(row.document), reason: row.change_reason, createdAt: row.created_at, createdBy: row.created_by } : null

export async function fetchSaleLayoutSnapshot(bookingId, hotelId) {
  if (!supabase || !bookingId || String(bookingId).startsWith('offline-')) return null
  const { data, error } = await supabase.from('sale_layout_snapshots').select('*').eq('booking_id', bookingId).eq('hotel_id', hotelId).maybeSingle()
  if (error) throw error
  return fromRow(data)
}

export async function fetchSaleLayoutHistory(bookingId, hotelId, limit = 30) {
  if (!supabase || !bookingId || String(bookingId).startsWith('offline-')) return []
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100)
  const { data, error } = await supabase.from('sale_layout_snapshot_history').select('id,booking_id,hotel_id,version,document,change_reason,created_by,created_at').eq('booking_id', bookingId).eq('hotel_id', hotelId).order('version', { ascending: false }).limit(safeLimit)
  if (error) throw error
  return (data || []).map(fromHistoryRow)
}

export async function saveSaleLayoutSnapshot({ bookingId, hotelId, document, expectedVersion = 0, reason = 'Modifica layout' }) {
  if (!supabase) throw new Error('Il salvataggio della pianta richiede una connessione')
  const checked = validateLayoutDocument(document)
  if (!checked.valid) throw new Error(checked.issues[0])
  const { data, error } = await supabase.rpc('save_sale_layout_snapshot_v2', { p_booking_id: bookingId, p_hotel_id: hotelId, p_document: checked.document, p_expected_version: expectedVersion, p_reason: String(reason || 'Modifica layout').slice(0, 120) })
  if (error) throw error
  return fromRow(Array.isArray(data) ? data[0] : data)
}

export async function restoreSaleLayoutSnapshot({ bookingId, hotelId, sourceVersion, expectedVersion }) {
  if (!supabase) throw new Error('Il ripristino della pianta richiede una connessione')
  const { data, error } = await supabase.rpc('restore_sale_layout_snapshot', { p_booking_id: bookingId, p_hotel_id: hotelId, p_source_version: Number(sourceVersion), p_expected_version: Number(expectedVersion) })
  if (error) throw error
  return fromRow(Array.isArray(data) ? data[0] : data)
}
