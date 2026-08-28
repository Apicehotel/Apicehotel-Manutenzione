import { supabase, supabaseUrl } from '../../supabase.js'

export const ENABLE_PREFIX = 'apicehotel.ntfy.setup.v2.'
export const VERIFIED_PREFIX = 'apicehotel.ntfy.verified.v2.'

export const getStore = (key) => { try { return localStorage.getItem(key) } catch { return null } }
export const setStore = (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch {} }

export const friendlyNtfyError = (error) => {
  const text = String(error?.message || error || '').trim()
  if (/load failed|failed to fetch|networkerror/i.test(text)) return 'Connessione al servizio ntfy non riuscita. Riprova tra qualche secondo.'
  if (/unauthorized|sessione/i.test(text)) return 'Sessione scaduta: esci e rientra in RandApp.'
  if (/alias_not_owned/i.test(text)) return 'Questo link notifiche appartiene a un altro operatore.'
  if (/invalid_alias/i.test(text)) return 'Link notifiche non valido.'
  if (/topic_not_configured/i.test(text)) return 'Canale ntfy non configurato per questa struttura.'
  if (/forbidden/i.test(text)) return 'Questo canale ntfy non è disponibile per il tuo ruolo.'
  return text || 'Configurazione ntfy non riuscita.'
}

async function authHeaders(){
  if (!supabase) throw new Error('Servizio notifiche non disponibile')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('Sessione RandApp non valida')
  const token = data?.session?.access_token
  if (!token) throw new Error('Sessione scaduta: esci e rientra in RandApp')
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX',
    'Content-Type': 'application/json',
    'X-RandApp-Request': `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}

async function invoke(name, body){
  const response = await fetch(`${supabaseUrl}/functions/v1/${encodeURIComponent(name)}`, {
    method: 'POST', cache: 'no-store', headers: await authHeaders(), body: JSON.stringify(body),
  })
  let payload = null
  try { payload = await response.json() } catch {}
  if (!response.ok) throw new Error(`${payload?.error || `HTTP ${response.status}`}${payload?.detail ? ` · ${payload.detail}` : ''}`)
  if (!payload?.ok) throw new Error(payload?.error || 'Operazione non riuscita')
  return payload
}

export async function invokeNtfy(name, hotelId, extra = {}) {
  return invoke(name,{ hotel_id: hotelId, ...extra })
}

export async function resolveNtfyShortLink(alias) {
  return invoke('ntfy-resolve',{ alias })
}
