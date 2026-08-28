import { supabase } from '../../supabase.js'
import { canUser } from '../../permissions.js'

export const canViewReminder = (user) => canUser(user, 'reminders', 'view')
export const canSendReminder = (user) => canUser(user, 'reminders', 'create')
export const canEditReminder = (user) => canUser(user, 'reminders', 'edit')
export const canDeleteReminder = (user) => canUser(user, 'reminders', 'delete')
export const canManageReminder = (user) => canUser(user, 'reminders', 'manage')

export async function fetchReminders(hotelId) {
  if (!supabase) return []
  const { data, error } = await supabase.from('promemoria').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function uploadReminderPhoto(hotelId, photoFile) {
  if (!photoFile) return null
  const ext = String(photoFile.name || 'foto.jpg').split('.').pop()?.toLowerCase() || 'jpg'
  const photoPath = `${hotelId}/promemoria/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('maintenance-photos').upload(photoPath, photoFile, { upsert: false, contentType: photoFile.type || 'image/jpeg' })
  if (error) throw error
  return photoPath
}

export async function createReminder(reminder, photoFile = null) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const photoPath = await uploadReminderPhoto(reminder.hotel_id, photoFile)
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

export async function updateReminderWithPhoto(item, changes, photoFile = null, removePhoto = false) {
  if (!supabase) throw new Error('Supabase non disponibile')
  let nextPhotoPath = item.photo_path || null
  let uploadedPath = null
  if (photoFile) {
    uploadedPath = await uploadReminderPhoto(item.hotel_id, photoFile)
    nextPhotoPath = uploadedPath
  } else if (removePhoto) {
    nextPhotoPath = null
  }
  const { data, error } = await supabase.from('promemoria').update({ ...changes, photo_path: nextPhotoPath, updated_at: new Date().toISOString() }).eq('id', item.id).select().single()
  if (error) {
    if (uploadedPath) await supabase.storage.from('maintenance-photos').remove([uploadedPath]).catch(() => {})
    throw error
  }
  if (item.photo_path && item.photo_path !== nextPhotoPath) {
    await supabase.storage.from('maintenance-photos').remove([item.photo_path]).catch(() => {})
  }
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
