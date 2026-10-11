import { supabase } from '../supabase.js'

/**
 * Recover a confirmed 'JWT issued at future' read failure at most once.
 * Never manufacture JWTs, ignore token validation, retry mutations, or log tokens.
 */
export const isFutureJwtError = (error) => /jwt\s+issued\s+(?:at\s+)?(?:the\s+)?future/i.test(String(error?.message || error || ''))

export async function readWithJwtRecovery(read) {
  try {
    return await read()
  } catch (error) {
    if (!isFutureJwtError(error) || !supabase) throw error
    let session = null
    try { ({ data: { session } } = await supabase.auth.getSession()) } catch { /* no recoverable auth session */ }
    if (!session?.refresh_token) {
      throw new Error('JWT issued at future: nessuna sessione Supabase rinnovabile. Verifica orologio automatico del dispositivo e configurazione JWT sul server.', { cause: error })
    }
    try {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
    } catch {
      throw new Error('JWT issued at future: rinnovo sessione fallito. Verifica data/ora automatiche e autenticazione.', { cause: error })
    }
    return read()
  }
}
