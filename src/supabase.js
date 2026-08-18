import { createClient } from '@supabase/supabase-js'

const fallbackUrl = 'https://ooqlfldcrnkudhgjnied.supabase.co'
const fallbackPublishableKey = 'sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX'

const url = import.meta.env.VITE_SUPABASE_URL || fallbackUrl
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackPublishableKey

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const isSupabaseConfigured = true
