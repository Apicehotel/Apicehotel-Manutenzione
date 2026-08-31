import { supabase } from '../supabase.js'

export async function fetchRandAIPriorities({ hotelId, user } = {}) {
  if (!supabase || !hotelId) return { items: [], recommendation: null }
  const { data, error } = await supabase.functions.invoke('randai-operational-priority', {
    body: {
      hotel_id: hotelId,
      actor: { name: user?.name || null, role: user?.role || null },
    },
  })
  if (error) throw error
  if (!data?.ok) throw Object.assign(new Error(data?.error || 'priority_unavailable'), { code: data?.error })
  return data
}
