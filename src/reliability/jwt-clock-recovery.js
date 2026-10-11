import { supabase } from '../supabase.js'
import { isFutureJwtError, JWT_CLOCK_USER_MESSAGE } from './jwt-errors.js'

export { isFutureJwtError, humanizeJwtClockError, JWT_CLOCK_USER_MESSAGE } from './jwt-errors.js'

/**
 * Recover a confirmed 'JWT issued at future' read failure at most once.
 * Never manufacture JWTs, ignore token validation, retry mutations, or log tokens.
 */
export async function readWithJwtRecovery(read) {
  try {
    return await read()
  } catch (error) {
    if (!isFutureJwtError(error) || !supabase) throw error
    let session = null
    try { ({ data: { session } } = await supabase.auth.getSession()) } catch { /* no recoverable auth session */ }
    if (!session?.refresh_token) {
      throw new Error(JWT_CLOCK_USER_MESSAGE, { cause: error })
    }
    try {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
    } catch {
      throw new Error(JWT_CLOCK_USER_MESSAGE, { cause: error })
    }
    return read()
  }
}
