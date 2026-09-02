import { supabase } from '../supabase.js'
import { assertSensitiveActionOnline } from '../session-policy.js'
import { assertContextScope } from '../reliability/context-scope-guard.js'
import {
  OperationValidationError,
  ValidationCode,
  combineValidation,
  required,
  validationIssue,
} from '../reliability/validation-engine.js'
import { getRandAIContext } from './context/envelope.js'

function validatePrepareInput({ hotelId, type, resourceId, input }) {
  const issues = [
    ...required(hotelId, 'hotelId'),
    ...required(type, 'type'),
    ...required(resourceId, 'resourceId'),
  ]
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    issues.push(validationIssue('input', ValidationCode.INVALID_VALUE, 'input deve essere un oggetto'))
  }
  const result = combineValidation(issues)
  if (!result.ok) throw new OperationValidationError(result, 'Azione RandAI non valida')
}

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
  validatePrepareInput({ hotelId, type, resourceId, input })
  const resolvedContext = context || getRandAIContext() || null
  assertContextScope({
    expected: {
      hotelId,
      module: 'issues',
      recordType: 'issue',
      recordId: resourceId,
      source: 'randapp',
      version: 1,
    },
    context: resolvedContext,
    requireResource: true,
    requireModule: true,
  })
  return invoke({
    operation: 'prepare',
    hotel_id: hotelId,
    action: { type, resource_id: resourceId, input },
    context: resolvedContext,
  })
}

export async function executeRandAIAction({ hotelId, approvalId } = {}) {
  const result = combineValidation(required(hotelId, 'hotelId'), required(approvalId, 'approvalId'))
  if (!result.ok) throw new OperationValidationError(result, 'Esecuzione RandAI non valida')
  return invoke({ operation: 'execute', hotel_id: hotelId, approval_id: approvalId })
}

export async function rejectRandAIAction({ hotelId, approvalId } = {}) {
  if (!hotelId || !approvalId) return null
  return invoke({ operation: 'reject', hotel_id: hotelId, approval_id: approvalId })
}
