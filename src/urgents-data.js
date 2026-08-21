import { supabase } from './supabase.js'

// ── Ponte avviso urgente app <-> riga DB (tabella richieste_urgenti) ─────────
// DB: id, hotel_id, nota, stato (aperta|presa|completata), creato_da, creato_il,
//     presa_in_carico_da, presa_in_carico_il, completata_da, completata_il,
//     trasformata_in_segnalazione_id
// App: id, hotelId, note, status (aperta|presa_in_carico|completata), createdBy,
//      createdAt, takenBy, completedBy, transformed
//
// Mappatura stati: DB 'presa' <-> app 'presa_in_carico'.

const statusToApp = { aperta: 'aperta', presa: 'presa_in_carico', completata: 'completata' }
const statusToDb = { aperta: 'aperta', presa_in_carico: 'presa', completata: 'completata' }

function fromRow(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    note: row.nota,
    status: statusToApp[row.stato] || 'aperta',
    createdBy: row.creato_da,
    createdAt: row.creato_il ? new Date(row.creato_il).getTime() : Date.now(),
    takenBy: row.presa_in_carico_da || null,
    completedBy: row.completata_da || null,
    transformed: !!row.trasformata_in_segnalazione_id,
  }
}

function toRow(item) {
  const row = {}
  const set = (col, val) => { if (val !== undefined) row[col] = val }
  set('hotel_id', item.hotelId)
  set('nota', item.note)
  if (item.status !== undefined) row.stato = statusToDb[item.status] || 'aperta'
  set('creato_da', item.createdBy)
  set('presa_in_carico_da', item.takenBy)
  set('completata_da', item.completedBy)
  if (item.status === 'presa_in_carico') row.presa_in_carico_il = new Date().toISOString()
  if (item.status === 'completata') row.completata_il = new Date().toISOString()
  return row
}

export async function fetchUrgents(hotelId) {
  if (!supabase) return { items: [], ok: false }
  const { data, error } = await supabase.from('richieste_urgenti').select('*').eq('hotel_id', hotelId).order('creato_il', { ascending: false })
  if (error) { console.error('fetchUrgents', error); return { items: [], ok: false, error: error.message } }
  return { items: (data || []).map(fromRow), ok: true }
}

export async function insertUrgent(item) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.from('richieste_urgenti').insert(toRow(item)).select().single()
  if (error) { console.error('insertUrgent', error); throw new Error(error.message) }
  return fromRow(data)
}

export async function updateUrgentRow(id, changes) {
  if (!supabase || !id) return null
  const { data, error } = await supabase.from('richieste_urgenti').update(toRow(changes)).eq('id', id).select().single()
  if (error) { console.error('updateUrgentRow', error); throw new Error(error.message) }
  return fromRow(data)
}

export function subscribeUrgents(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase.channel('apice-urgenti-' + hotelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'richieste_urgenti', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// Notifica push ai manutentori quando viene creato un nuovo avviso urgente.
// Non blocca il flusso né mostra un errore all'utente se la notifica non parte
// (la creazione dell'avviso è già andata a buon fine, la notifica è un extra),
// ma logga sempre l'errore reale — prima veniva nascosto anche in console,
// rendendo impossibile capire perché una notifica non fosse mai partita.
export async function notifyUrgent(hotelId, note) {
  if (!supabase) return
  try {
    const { data, error } = await supabase.functions.invoke('send-push', { body: { hotel_id: hotelId, title: 'Avviso urgente', body: note } })
    if (error) console.error('notifyUrgent', error)
    else if (data && data.ok === false) console.error('notifyUrgent', data.error)
    else if (data) console.info('notifyUrgent', data)
  } catch (error) {
    console.error('notifyUrgent', error)
  }
}
