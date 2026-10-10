import { createClient } from '@supabase/supabase-js'
import { createTimedFetch } from './async-timeout.js'

// Database unico dell'app unificata "Apice MultiHotel" (ooqlfldcrnkudhgjnied).
// I tre hotel condividono questo DB, separati dalla colonna hotel_id.
// Credenziali solo da VITE_* (fail-closed): niente fallback silenzioso a prod.
// Dev locale: `.env.development`. Build CI/Ocean: env/ARG espliciti.
const env = import.meta.env || {}
const url = String(env.VITE_SUPABASE_URL || '').trim()
const anonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
const SUPABASE_FETCH_TIMEOUT_MS = 20000

export const supabaseUrl = url
export const supabaseAnonKey = anonKey

if (typeof window !== 'undefined' && (!url || !anonKey)) {
  console.error('RandApp: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti — client non configurato')
}

// Evita di creare un client con storage/sessione browser durante test Node e tooling.
// Nel browser il comportamento resta invariato, con timeout di rete fail-closed.
export const supabase = typeof window !== 'undefined' && url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { fetch: createTimedFetch(SUPABASE_FETCH_TIMEOUT_MS) },
    })
  : null

export const isSupabaseConfigured = Boolean(supabase)
