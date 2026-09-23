import { createClient } from '@supabase/supabase-js'
import { createTimedFetch } from './async-timeout.js'

// Database unico dell'app unificata "Apice MultiHotel" (ooqlfldcrnkudhgjnied).
// I tre hotel condividono questo DB, separati dalla colonna hotel_id.
// Le credenziali possono essere sovrascritte da variabili d'ambiente (utile
// per ambienti diversi); in mancanza, si usano quelle del progetto MultiHotel.
const env = import.meta.env || {}
const url = env.VITE_SUPABASE_URL || 'https://ooqlfldcrnkudhgjnied.supabase.co'
const anonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX'
const SUPABASE_FETCH_TIMEOUT_MS = 20000

export const supabaseUrl = url
export const supabaseAnonKey = anonKey

// Evita di creare un client con storage/sessione browser durante test Node e tooling.
// Nel browser il comportamento resta invariato, con timeout di rete fail-closed.
export const supabase = typeof window !== 'undefined' && url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { fetch: createTimedFetch(SUPABASE_FETCH_TIMEOUT_MS) },
    })
  : null

export const isSupabaseConfigured = Boolean(supabase)
