import { supabase } from '../../supabase.js'

export async function invokeMcpBroker(capability, input = {}, context = {}) {
  if (!supabase) {
    const error = new Error('MCP broker non configurato')
    error.code = 'CAPABILITY_PROVIDER_UNAVAILABLE'
    error.safeToRetry = true
    throw error
  }
  const hotelId = String(context?.hotelId || '').trim()
  if (!hotelId) {
    const error = new Error('hotelId richiesto per capability MCP')
    error.code = 'MCP_HOTEL_SCOPE_REQUIRED'
    throw error
  }
  const { data, error } = await supabase.functions.invoke('rand-capability-broker', {
    body: { capability, hotelId, input },
  })
  if (error) {
    const failure = new Error(error.message || 'mcp_broker_unavailable')
    failure.code = 'CAPABILITY_PROVIDER_UNAVAILABLE'
    failure.safeToRetry = true
    throw failure
  }
  if (!data?.ok) {
    const failure = new Error(data?.error || 'mcp_broker_failed')
    failure.code = data?.error || 'mcp_broker_failed'
    failure.detail = data?.detail || null
    throw failure
  }
  return data.result
}
