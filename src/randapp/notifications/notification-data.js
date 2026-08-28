import { supabase } from '../../supabase.js'

const DAYS = 30
const sinceIso = () => new Date(Date.now() - DAYS * 86400000).toISOString()
const keyOf = (type, id) => `${type}:${id}`

async function signedPhoto(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const { data } = await supabase.storage.from('maintenance-photos').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}

export async function fetchNotificationInbox(hotelId, user) {
  if (!supabase || !hotelId || !user?.role) return { items: [], unread: 0 }
  const { data: auth } = await supabase.auth.getUser()
  const authUserId = auth?.user?.id || null
  const assignmentQuery = authUserId
    ? supabase.from('interventi').select('id,camera,categoria,note,stato,assegnatari,programmato_dal,creato_il,updated_at').eq('hotel_id', hotelId).eq('sezione', 'intervento').contains('assegnatari', [{ id: authUserId }]).gte('creato_il', sinceIso()).order('creato_il', { ascending: false }).limit(80)
    : Promise.resolve({ data: [], error: null })
  const [{ data: urgents, error: urgentError }, { data: sends, error: sendError }, { data: reads, error: readError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.from('richieste_urgenti').select('id,nota,stato,gravita,posizione,reparto,foto,creato_da,creato_il,updated_at').eq('hotel_id', hotelId).gte('creato_il', sinceIso()).order('creato_il', { ascending: false }).limit(60),
    supabase.from('promemoria_invio').select('id,promemoria_id,scheduled_for,sent_at,status').eq('hotel_id', hotelId).eq('status', 'sent').gte('sent_at', sinceIso()).order('sent_at', { ascending: false }).limit(80),
    supabase.from('notification_reads').select('source_type,source_id,read_at').eq('hotel_id', hotelId),
    assignmentQuery,
  ])
  if (urgentError) throw urgentError
  if (sendError) throw sendError
  if (readError) throw readError
  if (assignmentError) throw assignmentError

  const reminderIds = [...new Set((sends || []).map((x) => x.promemoria_id).filter(Boolean))]
  let reminders = []
  if (reminderIds.length) {
    const { data, error } = await supabase.from('promemoria').select('id,message,target_roles,photo_path,photo_url,created_by_name,created_by_role').in('id', reminderIds).contains('target_roles', [user.role])
    if (error) throw error
    reminders = data || []
  }
  const reminderMap = new Map(reminders.map((r) => [r.id, r]))
  const readSet = new Set((reads || []).map((r) => keyOf(r.source_type, r.source_id)))

  const urgentItems = await Promise.all((urgents || []).map(async (row) => ({
    key: keyOf('urgent', row.id),
    type: 'urgent',
    sourceId: String(row.id),
    title: row.gravita ? `Avviso ${row.gravita}` : 'Avviso urgente',
    message: row.nota || 'Avviso urgente della struttura',
    meta: [row.posizione, row.reparto, row.creato_da].filter(Boolean).join(' · '),
    at: row.creato_il || row.updated_at,
    photo: await signedPhoto(row.foto),
    read: readSet.has(keyOf('urgent', row.id)),
    status: row.stato,
  })))

  const reminderItems = await Promise.all((sends || []).map(async (send) => {
    const reminder = reminderMap.get(send.promemoria_id)
    if (!reminder) return null
    return {
      key: keyOf('reminder', send.id),
      type: 'reminder',
      sourceId: String(send.id),
      title: 'Promemoria',
      message: reminder.message,
      meta: [reminder.created_by_name, reminder.created_by_role].filter(Boolean).join(' · '),
      at: send.sent_at || send.scheduled_for,
      photo: await signedPhoto(reminder.photo_path || reminder.photo_url),
      read: readSet.has(keyOf('reminder', send.id)),
      status: 'sent',
    }
  }))

  const assignmentItems = (assignments || []).map((row) => ({
    key: keyOf('assignment', row.id),
    type: 'assignment',
    sourceId: String(row.id),
    title: 'Intervento assegnato',
    message: row.note || row.categoria || 'Ti è stato assegnato un intervento',
    meta: [row.camera, row.categoria, row.programmato_dal ? new Date(row.programmato_dal).toLocaleString('it-IT') : null].filter(Boolean).join(' · '),
    at: row.creato_il || row.updated_at,
    photo: null,
    read: readSet.has(keyOf('assignment', row.id)),
    status: row.stato,
  }))

  const items = [...urgentItems, ...reminderItems.filter(Boolean), ...assignmentItems]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 100)
  return { items, unread: items.filter((x) => !x.read).length }
}

export async function markNotificationRead(hotelId, item) {
  if (!supabase || !hotelId || !item?.sourceId) return
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return
  const { error } = await supabase.from('notification_reads').upsert({
    hotel_id: hotelId,
    source_type: item.type,
    source_id: String(item.sourceId),
    user_id: userId,
    read_at: new Date().toISOString(),
  }, { onConflict: 'user_id,hotel_id,source_type,source_id' })
  if (error) throw error
}

export async function markAllNotificationsRead(hotelId, items) {
  if (!supabase || !hotelId || !items?.length) return
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return
  const now = new Date().toISOString()
  const rows = items.filter((x) => !x.read).map((item) => ({
    hotel_id: hotelId,
    source_type: item.type,
    source_id: String(item.sourceId),
    user_id: userId,
    read_at: now,
  }))
  if (!rows.length) return
  const { error } = await supabase.from('notification_reads').upsert(rows, { onConflict: 'user_id,hotel_id,source_type,source_id' })
  if (error) throw error
}

export function subscribeNotificationInbox(hotelId, onChange) {
  if (!supabase || !hotelId) return () => {}
  const channel = supabase.channel(`notification-inbox-${hotelId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'richieste_urgenti', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'promemoria_invio', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventi', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_reads', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
