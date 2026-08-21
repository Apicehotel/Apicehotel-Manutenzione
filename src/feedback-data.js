import { supabase } from './supabase.js'

export async function insertFeedback(hotelId, userName, text) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { error } = await supabase.from('feedback').insert({ hotel_id: hotelId, utente: userName, testo: text })
  if (error) { console.error('insertFeedback', error); throw new Error(error.message) }
}

export async function fetchFeedback(hotelId) {
  if (!supabase) return { items: [], ok: false }
  const { data, error } = await supabase.from('feedback').select('*').eq('hotel_id', hotelId).order('creato_il', { ascending: false })
  if (error) { console.error('fetchFeedback', error); return { items: [], ok: false, error: error.message } }
  return { items: (data || []).map((row) => ({ id: row.id, userName: row.utente, text: row.testo, createdAt: new Date(row.creato_il).getTime() })), ok: true }
}

export function subscribeFeedback(hotelId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase.channel('apice-feedback-' + hotelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback', filter: `hotel_id=eq.${hotelId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
