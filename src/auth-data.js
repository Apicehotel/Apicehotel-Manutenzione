import { supabase } from './supabase.js'
import { assertSensitiveActionOnline } from './session-policy.js'

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
export async function loginWithPin({ hotelId, userId, pin }) { if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('pin-auth', { body: { hotel_id: hotelId, user_id: userId, pin } }); if (error) throw error; const session = await setReturnedSession(data); return { ...session, user: data?.user || session.user } }
export async function loginAdmin(pin) { assertSensitiveActionOnline('L’accesso amministratore'); if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('admin-gate', { body: { pin } }); if (error) throw error; return setReturnedSession(data) }
export async function changeOwnPin({ currentPin, newPin }) { assertSensitiveActionOnline('Il cambio PIN'); if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('user-pin', { body: { current_pin: currentPin, new_pin: newPin } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data }
export async function requestPinRecovery({ hotelId, userId }) { assertSensitiveActionOnline('Il recupero PIN'); if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('pin-recovery', { body: { action: 'request', hotel_id: hotelId, user_id: userId } }); if (error) throw error; if (data?.enabled === false) throw new Error('Recupero PIN via email non ancora configurato'); if (data?.error) throw new Error(data.error); return data }
export async function completePinRecovery({ token, newPin }) { assertSensitiveActionOnline('Il reset PIN'); if (!supabase) throw new Error('Supabase non configurato'); const { data, error } = await supabase.functions.invoke('pin-recovery', { body: { action: 'complete', token, new_pin: newPin } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data }
export async function updateOwnProfile({ email, phone, phoneCountryCode }) { assertSensitiveActionOnline('La modifica del profilo'); if (!supabase) throw new Error('Supabase non configurato'); const body = {}; if (email !== undefined) body.email = email; if (phone !== undefined) body.phone = phone; if (phoneCountryCode !== undefined) body.phone_country_code = phoneCountryCode; const { data, error } = await supabase.functions.invoke('user-pin', { body: { action: 'update_profile', ...body } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data }
export async function getOwnNotificationCode() {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.from('user_notification_codes').select('code').maybeSingle()
  if (error) throw error
  return data?.code || ''
}
export async function saveOwnNotificationCode(code) {
  assertSensitiveActionOnline('Il salvataggio del codice notifiche')
  if (!supabase) throw new Error('Supabase non configurato')
  const normalized = String(code || '').replace(/\D/g, '').slice(0, 6)
  if (!/^\d{6}$/.test(normalized)) throw new Error('Il codice notifiche deve contenere esattamente 6 cifre.')
  const existing = await getOwnNotificationCode()
  if (existing) throw new Error('Il codice notifiche è definitivo e non può essere modificato.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user?.id) throw userError || new Error('Sessione non valida')
  const { data, error } = await supabase.from('user_notification_codes').insert({ auth_user_id: userData.user.id, code: normalized }).select('code').single()
  if (error?.code === '23505') throw new Error('Questo codice è già stato assegnato. Scegline un altro.')
  if (error) throw error
  return data?.code || normalized
}
export async function setOwnPresence(present, hotelId = null) {
  assertSensitiveActionOnline('L’aggiornamento della presenza')
  if (!supabase) throw new Error('Supabase non configurato')
  if (present && !hotelId) throw new Error('Seleziona la struttura in cui ti trovi')
  const { data, error } = await supabase.functions.invoke('user-pin', { body: { action: 'set_presence', present: Boolean(present), hotel_id: present ? hotelId : null } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
export async function validateSupabaseSession() {
  if (!supabase) return { valid: false, user: null }
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData?.session
  if (!session) return { valid: false, user: null }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { valid: true, user: session.user, offline: true }
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) return { valid: false, user: null }
    return { valid: true, user: data.user }
  } catch {
    return { valid: true, user: session.user, offline: true }
  }
}
export async function signOutSupabase() { if (!supabase) return; try { await supabase.auth.signOut() } catch { /* La sessione applicativa viene comunque rimossa. */ } }
