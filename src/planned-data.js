import { supabase } from './supabase.js'

// ── Ponte intervento pianificato app <-> riga DB (tabella interventi) ────────
// DB: id, hotel_id, camera, categoria, note, programmato_il, programmato_dal,
//     programmato_al, assegnatari(jsonb), stato, camere(jsonb),
//     camere_fatte(jsonb), piani(jsonb), creato_da, creato_il, completato_da,
//     completato_il, pezzo_sostituito, foto_dopo, ...
// App: id, hotelId, location, locationMode, category, notes, scheduledAt,
//      scheduledUntil, assignees, status, rooms, roomsDone, createdBy,
//      createdAt, completedBy, completedAt, pieceReplaced, photoAfter

function fromRow(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    location: row.camera,
    locationMode: row.location_mode || 'zona',
    category: row.categoria,
    notes: row.note,
    scheduledAt: row.programmato_dal ? new Date(row.programmato_dal).getTime() : null,
    scheduledUntil: row.programmato_al ? new Date(row.programmato_al).getTime() : null,
    assignees: row.assegnatari || [],
    status: row.stato || 'pending',
    rooms: row.camere || null,
    roomsDone: row.camere_fatte || {},
    createdBy: row.creato_da,
    createdAt: row.creato_il ? new Date(row.creato_il).getTime() : Date.now(),
    completedBy: row.completato_da || null,
    completedAt: row.completato_il ? new Date(row.completato_il).getTime() : null,
    pieceReplaced: row.pezzo_sostituito || null,
    photoAfter: row.foto_dopo || null,
    toFinishBy: row.da_finire_da || null,
    toFinishAt: row.da_finire_il ? new Date(row.da_finire_il).getTime() : null,
  }
}

function toRow(item) {
  const row = {}
  const set = (col, val) => { if (val !== undefined) row[col] = val }
  set('hotel_id', item.hotelId)
  set('camera', item.location)
  set('location_mode', item.locationMode)
  set('categoria', item.category)
  set('note', item.notes)
  if (item.scheduledAt !== undefined) row.programmato_dal = item.scheduledAt ? new Date(item.scheduledAt).toISOString() : null
  if (item.scheduledUntil !== undefined) row.programmato_al = item.scheduledUntil ? new Date(item.scheduledUntil).toISOString() : null
  set('assegnatari', item.assignees)
  set('stato', item.status)
  set('camere', item.rooms)
  set('camere_fatte', item.roomsDone)
  set('creato_da', item.createdBy)
  set('completato_da', item.completedBy)
  set('pezzo_sostituito', item.pieceReplaced)
  set('foto_dopo', item.photoAfter)
  set('da_finire_da', item.toFinishBy)
  if (item.toFinishAt !== undefined) row.da_finire_il = item.toFinishAt ? new Date(item.toFinishAt).toISOString() : null
  if (item.status === 'done' && item.completedAt) row.completato_il = new Date(item.completedAt).toISOString()
  return row
}

export async function fetchPlanned(hotelId) {
  if (!supabase) return { items: [], ok: false }
  try {
    const { data, error } = await supabase.from('interventi').select('*').eq('hotel_id', hotelId).order('creato_il', { ascending: false })
    if (error) return { items: [], ok: false }
    return { items: (data || []).map(fromRow), ok: true }
  } catch { return { items: [], ok: false } }
}

export async function insertPlanned(item) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('interventi').insert(toRow(item)).select().single()
    if (error || !data) return null
    return fromRow(data)
  } catch { return null }
}

export async function updatePlannedRow(id, changes) {
  if (!supabase || !id) return null
  try {
    const { data, error } = await supabase.from('interventi').update(toRow(changes)).eq('id', id).select().single()
    if (error || !data) return null
    return fromRow(data)
  } catch { return null }
}

export async function deletePlannedRow(id) {
  if (!supabase || !id) return false
  try {
    const { error } = await supabase.from('interventi').delete().eq('id', id)
    return !error
  } catch { return false }
}

export function subscribePlanned(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase.channel('apice-interventi-' + hotelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventi', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
