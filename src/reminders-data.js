import { supabase } from './supabase.js'

export const REMINDER_SEND_ROLES = ['admin', 'Supremo', 'Direzione', 'Direttore Centro Congressi', 'Reception']
export const canSendReminder = (user) => REMINDER_SEND_ROLES.includes(user?.role)

export async function fetchReminders(hotelId) {
  if (!supabase) return []
  const { data, error } = await supabase.from('promemoria').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createReminder(reminder, photoFile = null) {
  if (!supabase) throw new Error('Supabase non disponibile')
  let photoPath = null
  if (photoFile) {
    const ext = String(photoFile.name || 'foto.jpg').split('.').pop()?.toLowerCase() || 'jpg'
    photoPath = `${reminder.hotel_id}/promemoria/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('maintenance-photos').upload(photoPath, photoFile, { upsert: false, contentType: photoFile.type || 'image/jpeg' })
    if (uploadError) throw uploadError
  }
  const payload = { ...reminder, photo_path: photoPath }
  const { data, error } = await supabase.from('promemoria').insert(payload).select().single()
  if (error) {
    if (photoPath) await supabase.storage.from('maintenance-photos').remove([photoPath]).catch(() => {})
    throw error
  }
  return data
}

export async function updateReminder(id, changes) {
  const { data, error } = await supabase.from('promemoria').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteReminder(id) {
  const { data: row } = await supabase.from('promemoria').select('photo_path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('promemoria').delete().eq('id', id)
  if (error) throw error
  if (row?.photo_path) await supabase.storage.from('maintenance-photos').remove([row.photo_path]).catch(() => {})
}

export function subscribeReminders(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase.channel(`promemoria-${hotelId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'promemoria', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
