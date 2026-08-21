import { supabase } from './supabase.js'

// ── Ponte prenotazione sala app <-> riga DB (tabella prenotazioni_sale) ──────
// DB: id, hotel_id, sala, data, data_al, turno, cliente, note, stato,
//     creato_da, creato_il, da_finire_da, da_finire_il, completata_da,
//     completata_il
// App: id, hotelId, room, dateFrom, dateTo, shift, client, notes, status,
//      createdBy, createdAt, toFinishBy, toFinishAt, doneBy, doneAt

function fromRow(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    room: row.sala,
    dateFrom: row.data,
    dateTo: row.data_al || row.data,
    shift: row.turno,
    client: row.cliente,
    notes: row.note || '',
    status: row.stato || 'pending',
    createdBy: row.creato_da,
    createdAt: row.creato_il ? new Date(row.creato_il).getTime() : Date.now(),
    toFinishBy: row.da_finire_da || null,
    toFinishAt: row.da_finire_il ? new Date(row.da_finire_il).getTime() : null,
    doneBy: row.completata_da || null,
    doneAt: row.completata_il ? new Date(row.completata_il).getTime() : null,
  }
}

function toRow(item) {
  const row = {}
  const set = (col, val) => { if (val !== undefined) row[col] = val }
  set('hotel_id', item.hotelId)
  set('sala', item.room)
  set('data', item.dateFrom)
  set('data_al', item.dateTo)
  set('turno', item.shift)
  set('cliente', item.client)
  set('note', item.notes)
  set('stato', item.status)
  set('creato_da', item.createdBy)
  set('da_finire_da', item.toFinishBy)
  if (item.toFinishAt !== undefined) row.da_finire_il = item.toFinishAt ? new Date(item.toFinishAt).toISOString() : null
  set('completata_da', item.doneBy)
  if (item.doneAt !== undefined) row.completata_il = item.doneAt ? new Date(item.doneAt).toISOString() : null
  return row
}

export async function fetchBookings(hotelId) {
  if (!supabase) return { items: [], ok: false }
  const { data, error } = await supabase.from('prenotazioni_sale').select('*').eq('hotel_id', hotelId).order('data', { ascending: true })
  if (error) { console.error('fetchBookings', error); return { items: [], ok: false, error: error.message } }
  return { items: (data || []).map(fromRow), ok: true }
}

export async function insertBooking(item) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.from('prenotazioni_sale').insert(toRow(item)).select().single()
  if (error) { console.error('insertBooking', error); throw new Error(error.message) }
  return fromRow(data)
}

export async function updateBookingRow(id, changes) {
  if (!supabase || !id) return null
  const { data, error } = await supabase.from('prenotazioni_sale').update(toRow(changes)).eq('id', id).select().single()
  if (error) { console.error('updateBookingRow', error); throw new Error(error.message) }
  return fromRow(data)
}

export async function deleteBookingRow(id) {
  if (!supabase || !id) return
  const { error } = await supabase.from('prenotazioni_sale').delete().eq('id', id)
  if (error) { console.error('deleteBookingRow', error); throw new Error(error.message) }
}

export function subscribeBookings(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase.channel('apice-sale-' + hotelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prenotazioni_sale', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
