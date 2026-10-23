import { supabase } from './supabase.js'

export async function requestPresence(body = {}) {
  if (!supabase) throw new Error('Presenza non disponibile')
  const { data, error } = await supabase.functions.invoke('presence-status', { body })
  if (error) {
    // FunctionsHttpError carries the server response, not its useful message.
    let payload
    try { payload = await error.context?.clone?.().json() } catch { /* transport / non-JSON response */ }
    const status = error.context?.status
    const message = typeof payload?.error === 'string' && !/jwt|token|sql|pgrst/i.test(payload.error)
      ? payload.error
      : status === 401 ? 'Sessione da verificare. Riprova tra poco.'
        : status === 403 ? 'Presenza non autorizzata per questa struttura.'
          : 'Servizio presenza temporaneamente non disponibile. Riprova.'
    throw new Error(message)
  }
  if (!data?.ok) throw new Error(data?.error || 'Presenza non disponibile')
  if (body.action === 'set_presence' && typeof data.in_struttura !== 'boolean') {
    throw new Error('Servizio presenza da aggiornare. Nessuna modifica confermata.')
  }
  return data
}
