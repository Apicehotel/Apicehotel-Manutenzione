import { supabase, supabaseAnonKey, supabaseUrl } from './supabase.js'

const API_TIMEOUT_MS = 20000

export async function callSupplyApi(action, payload = {}) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sessione non disponibile')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/supply-api`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
      signal: controller.signal,
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.ok) {
      const code = result?.error || `SUPPLY_API_${response.status}`
      throw new Error(code)
    }
    return result
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Rifornimenti: timeout di rete')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
