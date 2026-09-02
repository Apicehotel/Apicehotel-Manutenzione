export const ModelCapability = Object.freeze({
  FAST: 'fast', REASONING: 'reasoning', CODING: 'coding', VISION: 'vision', LONG_CONTEXT: 'long_context', LOCAL: 'local',
})

export const PrivacyLevel = Object.freeze({ PUBLIC: 'public', STANDARD: 'standard', SENSITIVE: 'sensitive', LOCAL_ONLY: 'local_only' })
export const RoutingPriority = Object.freeze({ QUALITY: 'quality', BALANCED: 'balanced', COST: 'cost', LATENCY: 'latency', PRIVACY: 'privacy' })

const finiteUnit = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1

export function validateModelDescriptor(input = {}) {
  if (!String(input.id || '').trim() || !String(input.provider || '').trim()) throw new TypeError('Model descriptor requires id and provider')
  if (!Array.isArray(input.capabilities) || !input.capabilities.length) throw new TypeError('Model descriptor requires capabilities')
  if (new Set(input.capabilities).size !== input.capabilities.length) throw new TypeError('Model capabilities must be unique')
  for (const capability of input.capabilities) if (!Object.values(ModelCapability).includes(capability)) throw new TypeError(`Invalid model capability: ${capability}`)
  if (!Object.values(PrivacyLevel).includes(input.privacy || PrivacyLevel.STANDARD)) throw new TypeError(`Invalid privacy level: ${input.privacy}`)
  for (const field of ['reliability', 'quality', 'cost', 'latency']) {
    if (input[field] != null && !finiteUnit(input[field])) throw new TypeError(`${field} must be between 0 and 1`)
  }
  if (input.contextWindow != null && (!Number.isInteger(Number(input.contextWindow)) || Number(input.contextWindow) < 0)) {
    throw new TypeError('contextWindow must be an integer >= 0')
  }
  return true
}

export function validateRouteRequest(input = {}) {
  const required = input.requiredCapabilities || []
  if (!Array.isArray(required)) throw new TypeError('requiredCapabilities must be an array')
  for (const capability of required) if (!Object.values(ModelCapability).includes(capability)) throw new TypeError(`Invalid required capability: ${capability}`)
  if (input.priority && !Object.values(RoutingPriority).includes(input.priority)) throw new TypeError(`Invalid routing priority: ${input.priority}`)
  if (input.privacy && !Object.values(PrivacyLevel).includes(input.privacy)) throw new TypeError(`Invalid route privacy: ${input.privacy}`)
  if (input.minContextWindow != null && (!Number.isInteger(Number(input.minContextWindow)) || Number(input.minContextWindow) < 0)) {
    throw new TypeError('minContextWindow must be an integer >= 0')
  }
  if (input.excludeModelIds != null && !Array.isArray(input.excludeModelIds)) throw new TypeError('excludeModelIds must be an array')
  return true
}
