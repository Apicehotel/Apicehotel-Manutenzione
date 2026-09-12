import { supabase } from './supabase.js'

export async function submitRandGatewayEnvelope(envelope) {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.functions.invoke('rand-gateway', { body: envelope })
  if (error) throw error
  if (!data?.ok) {
    const failure = new Error(data?.error || 'rand_gateway_unavailable')
    failure.code = data?.error || 'rand_gateway_unavailable'
    failure.detail = data?.detail || null
    throw failure
  }
  return data
}
