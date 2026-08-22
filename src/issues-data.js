import { supabase } from './supabase.js'

// ── Ponte tra segnalazione app (camelCase) e riga DB (snake_case) ────────────
// Colonne DB (tabella segnalazioni): id, hotel_id, camera, urgenza, categoria,
// stato, stato_camera, note, foto_prima, foto_dopo, creato_da, creato_il,
// completato_da, completato_il, nota_completamento, pezzo_nome,
// pezzo_decisione, pezzo_decisione_da, pezzo_sostituito, pezzo_sostituito_da,
// tecnico_richiesto_da, tecnico_richiesto_il, ...
//
// Nell'app la segnalazione usa: id, hotelId, room (stringa intera → camera),
// urgency, category, status, roomStatus, title (→ note/testo problema),
// photoData (→ foto_prima), completionPhotoData (→ foto_dopo), createdByName,
// completedBy, completionNote, pieceName, pieceDecision, ecc.
//
// Nota: 'date' e 'department' e 'origin' sono presentazione/logica lato app,
// non colonne del DB. La data reale è creato_il (timestamp); da lì l'app
// ricostruisce l'etichetta 'date' per la UI.

function labelDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const oggi = new Date()
  const ieri = new Date(); ieri.setDate(oggi.getDate() - 1)
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === oggi.toDateString()) return `Oggi, ${ora}`
  if (d.toDateString() === ieri.toDateString()) return `Ieri, ${ora}`
  return `${d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}, ${ora}`
}

export function fromRow(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    room: row.camera,
    urgency: row.urgenza,
    category: row.categoria,
    status: row.stato,
    roomStatus: row.stato_camera || null,
    title: row.note,
    photoData: row.foto_prima || null,
    completionPhotoData: row.foto_dopo || null,
    createdByName: row.creato_da || null,
    createdAt: row.creato_il ? new Date(row.creato_il).getTime() : null,
    date: labelDate(row.creato_il),
    completedBy: row.completato_da || null,
    completedAt: row.completato_il ? new Date(row.completato_il).getTime() : null,
    completionNote: row.nota_completamento || null,
    pieceName: row.pezzo_nome || null,
    pieceDecision: row.pezzo_decisione || null,
    pieceDecisionBy: row.pezzo_decisione_da || null,
    pieceReplaced: row.pezzo_sostituito || null,
    pieceReplacedBy: row.pezzo_sostituito_da || null,
    technicianRequestedBy: row.tecnico_richiesto_da || null,
    technicianId: row.tecnico_id || null,
    technicianName: row.tecnico_nome || null,
    technicianPhone: row.tecnico_telefono || null,
    technicianExpectedArrival: row.tecnico_arrivo_previsto ? new Date(row.tecnico_arrivo_previsto).getTime() : null,
    origin: row.origine || 'App',
    department: row.reparto || null,
  }
}

// Costruisce la riga DB da un oggetto parziale/completo dell'app.
// Include solo i campi presenti (per gli update parziali).
function toRow(issue) {
  const row = {}
  const set = (col, val) => { if (val !== undefined) row[col] = val }
  set('hotel_id', issue.hotelId)
  set('camera', issue.room)
  set('urgenza', issue.urgency)
  set('categoria', issue.category)
  set('stato', issue.status)
  set('stato_camera', issue.roomStatus)
  set('note', issue.title)
  set('foto_prima', issue.photoData)
  set('foto_dopo', issue.completionPhotoData)
  set('creato_da', issue.createdByName)
  set('completato_da', issue.completedBy)
  set('nota_completamento', issue.completionNote)
  set('pezzo_nome', issue.pieceName)
  set('pezzo_decisione', issue.pieceDecision)
  set('pezzo_decisione_da', issue.pieceDecisionBy)
  set('pezzo_sostituito', issue.pieceReplaced)
  set('pezzo_sostituito_da', issue.pieceReplacedBy)
  set('tecnico_richiesto_da', issue.technicianRequestedBy)
  set('tecnico_id', issue.technicianId)
  set('tecnico_nome', issue.technicianName)
  set('tecnico_telefono', issue.technicianPhone)
  if (issue.technicianExpectedArrival !== undefined) row.tecnico_arrivo_previsto = issue.technicianExpectedArrival ? new Date(issue.technicianExpectedArrival).toISOString() : null
  set('origine', issue.origin)
  set('reparto', issue.department)
  // completato_il / tecnico_richiesto_il: derivati dallo stato
  if (issue.status === 'done' && issue.completedAt) row.completato_il = new Date(issue.completedAt).toISOString()
  if (issue.status === 'tecnico' && issue.technicianRequestedBy) row.tecnico_richiesto_il = new Date().toISOString()
  return row
}

// Carica le segnalazioni di un hotel. Ritorna [] se il DB non risponde.
export async function fetchIssues(hotelId) {
  if (!supabase) return { issues: [], ok: false }
  try {
    const { data, error } = await supabase.from('segnalazioni').select('*').eq('hotel_id', hotelId).order('creato_il', { ascending: false })
    if (error) return { issues: [], ok: false }
    return { issues: (data || []).map(fromRow), ok: true }
  } catch { return { issues: [], ok: false } }
}

// Crea una nuova segnalazione. Ritorna la segnalazione creata (con id DB) o null.
export async function insertIssue(issue) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('segnalazioni').insert(toRow(issue)).select().single()
    if (error || !data) return null
    return fromRow(data)
  } catch { return null }
}

// Aggiorna una segnalazione esistente (update parziale).
export async function updateIssueRow(id, changes) {
  if (!supabase || !id) return null
  try {
    const { data, error } = await supabase.from('segnalazioni').update(toRow(changes)).eq('id', id).select().single()
    if (error || !data) return null
    return fromRow(data)
  } catch { return null }
}

// Elimina una segnalazione.
export async function deleteIssueRow(id) {
  if (!supabase || !id) return false
  try {
    const { error } = await supabase.from('segnalazioni').delete().eq('id', id)
    return !error
  } catch { return false }
}

// Sottoscrizione realtime alle segnalazioni di un hotel: richiama onChange a
// ogni inserimento/modifica/eliminazione. Ritorna la funzione di cleanup.
export function subscribeIssues(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase.channel('apice-segnalazioni-' + hotelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'segnalazioni', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
