import { supabase } from './supabase.js'

function sessionTokens(data) {
  const session = data?.session || data
  const accessToken = session?.access_token
  const refreshToken = session?.refresh_token
  return accessToken && refreshToken ? { access_token: accessToken, refresh_token: refreshToken } : null
}

async function setReturnedSession(data) {
  if (!supabase) throw new Error('Supabase non configurato')
  const tokens = sessionTokens(data)
  if (!tokens) throw new Error('La funzione non ha restituito una sessione valida')
  const { data: result, error } = await supabase.auth.setSession(tokens)
  if (error || !result?.session) throw error || new Error('Impossibile impostare la sessione Supabase')
  return result.session
}

export async function loginWithPin({ hotelId, userId, pin }) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('pin-auth', {
    body: { hotel_id: hotelId, user_id: userId, pin },
  })
  if (error) throw error
  return setReturnedSession(data)
}

export async function loginAdmin(pin) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('admin-gate', {
    body: { pin },
  })
  if (error) throw error
  return setReturnedSession(data)
}

export async function changeOwnPin({ currentPin, newPin }) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('user-pin', {
    body: { current_pin: currentPin, new_pin: newPin },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function setOwnPresence(present) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('user-pin', {
    body: { action: 'set_presence', present: Boolean(present) },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function validateSupabaseSession() {
  if (!supabase) return { valid: false, user: null }
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session) return { valid: false, user: null }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { valid: false, user: null }
  return { valid: true, user: data.user }
}

export async function signOutSupabase() {
  if (!supabase) return
  try { await supabase.auth.signOut() } catch { /* La sessione applicativa viene comunque rimossa. */ }
}
