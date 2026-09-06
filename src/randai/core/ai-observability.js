import { startExternalSpan } from '../../external-telemetry.js'

function safeAttribute(value) {
  if (typeof value === 'string') return value.slice(0, 160)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

export function startRandAISpan(operation, attributes = {}) {
  const safe = {
    'rand.component': 'randai',
    ...Object.fromEntries(
      Object.entries(attributes)
        .map(([key, value]) => [key, safeAttribute(value)])
        .filter(([, value]) => value !== undefined),
    ),
  }
  return startExternalSpan(`randai.${String(operation || 'operation')}`, safe)
}

export async function traceRandAIOperation(operation, attributes, fn) {
  const span = startRandAISpan(operation, attributes)
  try {
    const result = await fn()
    span?.setAttribute?.('rand.outcome', 'success')
    return result
  } catch (error) {
    span?.setAttribute?.('rand.outcome', 'error')
    span?.setAttribute?.('error.type', String(error?.name || 'Error').slice(0, 80))
    throw error
  } finally {
    span?.end?.()
  }
}
