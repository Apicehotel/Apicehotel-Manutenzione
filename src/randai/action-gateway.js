import { supabase } from '../supabase.js'
import { assertSensitiveActionOnline } from '../session-policy.js'
import { getRandAIContext } from './context/envelope.js'

async function invoke(body) {
  assertSensitiveActionOnline('Le azioni operative RandAI')
  if (!supabase) throw new Error('Supabase non disponibile')
  const { data, error } = await supabase.functions.invoke('randai-action-gateway', { body })
  if (error) throw error
  if (!data?.ok) {
    const err = new Error(data?.error || 'action_gateway_unavailable')
    err.code = data?.error || 'action_gateway_unavailable'
    err.detail = data
    throw err
  }
  return data
}

export async function prepareRandAIAction({ hotelId, type, resourceId, input = {}, context = null } = {}) {
  if (!hotelId || !type || !resourceId) throw new TypeError('hotelId, type e resourceId sono obbligatori')
  return invoke({
    operation: 'prepare',
    hotel_id: hotelId,
    action: { type, resource_id: resourceId, input },
    context: context || getRandAIContext() || null,
  })
}

export async function executeRandAIAction({ hotelId, approvalId } = {}) {
  if (!hotelId || !approvalId) throw new TypeError('hotelId e approvalId sono obbligatori')
  return invoke({ operation: 'execute', hotel_id: hotelId, approval_id: approvalId })
}

export async function rejectRandAIAction({ hotelId, approvalId } = {}) {
  if (!hotelId || !approvalId) return null
  return invoke({ operation: 'reject', hotel_id: hotelId, approval_id: approvalId })
}
