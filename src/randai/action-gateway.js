import { assertSensitiveActionOnline } from '../session-policy.js'
import { assertContextScope } from '../reliability/context-scope-guard.js'
import { assertActionMayExecute } from '../reliability/execution-policy.js'
import {
  OperationValidationError,
  ValidationCode,
  combineValidation,
  required,
  validationIssue,
} from '../reliability/validation-engine.js'
import { getRandAIContext } from './context/envelope.js'
import { getRandActionDefinition } from './actions/catalog.js'
import { RandCapability } from './core/capability-providers.js'
import { randCapabilityRouter } from './core/capability-runtime.js'

function actionTypeIssue(type) {
  const definition = getRandActionDefinition(type)
  return definition?.surfaces?.randapp === true
    ? []
    : [validationIssue('type', ValidationCode.INVALID_VALUE, 'Azione non esposta a RandApp')]
}

function validatePrepareInput({ hotelId, type, resourceId, input }) {
  const issues = [
    ...required(hotelId, 'hotelId'),
    ...required(type, 'type'),
    ...required(resourceId, 'resourceId'),
    ...actionTypeIssue(type),
  ]
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    issues.push(validationIssue('input', ValidationCode.INVALID_VALUE, 'input deve essere un oggetto'))
  }
  const result = combineValidation(issues)
  if (!result.ok) throw new OperationValidationError(result, 'Azione RandAI non valida')
}

function validateExecutionInput({ hotelId, approvalId, type, resourceId }) {
  const result = combineValidation(
    required(hotelId, 'hotelId'),
    required(approvalId, 'approvalId'),
    required(type, 'type'),
    required(resourceId, 'resourceId'),
    actionTypeIssue(type),
  )
  if (!result.ok) throw new OperationValidationError(result, 'Esecuzione RandAI non valida')
}

async function invokeGateway({ hotelId, type, resourceId, input = {}, approvalId = null, approvalDecision = 'execute' }) {
  assertSensitiveActionOnline('Le azioni operative RandAI')
  const { value } = await randCapabilityRouter.invoke(RandCapability.OPERATIONAL_ACTION, { envelope: {
    channel: 'randapp',
    direction: 'inbound',
    actor: { hotelId },
    conversation: { type: 'system' },
    payload: {
      type: 'tool_request',
      toolRequest: {
        name: type,
        targetHotelId: hotelId,
        arguments: { resourceId, input },
        approvalId,
      },
      metadata: { approvalDecision },
    },
    origin: { provider: 'randapp', providerMessageId: crypto.randomUUID() },
  } }, { allowExecutionFallback: false })
  return value
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
  const result = await invokeGateway({ hotelId, type, resourceId, input })
  return {
    ok: true,
    operation: 'prepared',
    plan: {
      ...(result.approval || {}),
      approval_id: result.approvalId,
      input: result.approval?.input || input,
    },
  }
}

export async function executeRandAIAction({ hotelId, approvalId, type, resourceId, input = {} } = {}) {
  validateExecutionInput({ hotelId, approvalId, type, resourceId })
  const response = await invokeGateway({ hotelId, approvalId, type, resourceId, input })
  return response.result
}

export async function executeGovernedRandAIAction({ hotelId, approvalId, type, resourceId, input = {}, planValidation, confidenceDecision, permissionGranted = false } = {}) {
  validateExecutionInput({ hotelId, approvalId, type, resourceId })
  assertActionMayExecute({
    hotelId,
    planValidation,
    confidenceDecision,
    permissionGranted,
    approvalPresent: Boolean(approvalId),
  })
  return executeRandAIAction({ hotelId, approvalId, type, resourceId, input })
}

export async function rejectRandAIAction({ hotelId, approvalId, type, resourceId, input = {} } = {}) {
  if (!hotelId || !approvalId || !type || !resourceId || !getRandActionDefinition(type)?.surfaces?.randapp) return null
  const response = await invokeGateway({ hotelId, approvalId, type, resourceId, input, approvalDecision: 'reject' })
  return response.result
}
