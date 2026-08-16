import { supabase } from './supabase.js'

// ── Ponte tra il DB (colonne snake_case) e l'app (campi camelCase) ───────────
// La tabella utenti nel DB usa: id, nome, ruolo, pin, hotels[], puo_admin,
// zone_consentite[], telefono, deve_cambiare_pin, in_struttura, ...
// L'app usa: id, name, role, pin, hotels[], puoAdmin, department, ...
// department non esiste come colonna a sé: lo teniamo dentro il ruolo/logica
// dell'app come già fa oggi. Qui mappiamo solo i campi che il DB conosce.

function fromRow(row) {
  return {
    id: row.id,
    name: row.nome,
    role: row.ruolo,
    pin: row.pin,
    hotels: row.hotels || [],
    puoAdmin: row.puo_admin || false,
    department: row.department || undefined, // colonna opzionale, se presente
    zoneConsentite: row.zone_consentite || undefined,
    telefono: row.telefono || undefined,
    deveCambiarePin: row.deve_cambiare_pin || false,
  }
}

function toRow(user) {
  const row = {
    nome: user.name,
    ruolo: user.role,
    pin: user.pin,
    hotels: user.hotels || [],
    puo_admin: user.puoAdmin || false,
  }
  // campi opzionali: li includiamo solo se valorizzati, per non forzare colonne
  if (user.department !== undefined) row.department = user.department
  if (user.zoneConsentite !== undefined) row.zone_consentite = user.zoneConsentite
  if (user.telefono !== undefined) row.telefono = user.telefono
  if (user.deveCambiarePin !== undefined) row.deve_cambiare_pin = user.deveCambiarePin
  // id: solo se già esistente (per update); in insert lo genera il DB
  if (user.id && !user.id.startsWith('local-')) row.id = user.id
  return row
}

// Carica tutti gli utenti dal DB. Ritorna [] se il DB non è raggiungibile
// (l'app resta usabile e mostra lista vuota, senza crashare).
export async function fetchUsers() {
  if (!supabase) return { users: [], ok: false }
  try {
    const { data, error } = await supabase.from('utenti').select('*').order('nome')
    if (error) return { users: [], ok: false }
    return { users: (data || []).map(fromRow), ok: true }
  } catch {
    return { users: [], ok: false }
  }
}

// Inserisce un nuovo utente. Ritorna l'utente creato (con id dal DB) o null.
export async function insertUser(user) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('utenti').insert(toRow(user)).select().single()
    if (error || !data) return null
    return fromRow(data)
  } catch { return null }
}

// Aggiorna un utente esistente per id.
export async function updateUserRow(user) {
  if (!supabase || !user.id) return null
  try {
    const { data, error } = await supabase.from('utenti').update(toRow(user)).eq('id', user.id).select().single()
    if (error || !data) return null
    return fromRow(data)
  } catch { return null }
}

// Elimina un utente per id.
export async function deleteUserRow(id) {
  if (!supabase || !id) return false
  try {
    const { error } = await supabase.from('utenti').delete().eq('id', id)
    return !error
  } catch { return false }
}

// Aggiorna solo il PIN di un utente (usato dal cambio PIN personale).
export async function updateUserPin(id, pin) {
  if (!supabase || !id) return false
  try {
    const { error } = await supabase.from('utenti').update({ pin, deve_cambiare_pin: false }).eq('id', id)
    return !error
  } catch { return false }
}
