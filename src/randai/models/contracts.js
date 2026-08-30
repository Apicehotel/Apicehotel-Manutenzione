export const ModelCapability = Object.freeze({
  FAST: 'fast', REASONING: 'reasoning', CODING: 'coding', VISION: 'vision', LONG_CONTEXT: 'long_context', LOCAL: 'local',
})

export const PrivacyLevel = Object.freeze({ PUBLIC: 'public', STANDARD: 'standard', SENSITIVE: 'sensitive', LOCAL_ONLY: 'local_only' })
export const RoutingPriority = Object.freeze({ QUALITY: 'quality', BALANCED: 'balanced', COST: 'cost', LATENCY: 'latency', PRIVACY: 'privacy' })

export function validateModelDescriptor(input = {}) {
  if (!input.id || !input.provider) throw new TypeError('Model descriptor requires id and provider')
  if (!Array.isArray(input.capabilities) || !input.capabilities.length) throw new TypeError('Model descriptor requires capabilities')
  for (const capability of input.capabilities) if (!Object.values(ModelCapability).includes(capability)) throw new TypeError(`Invalid model capability: ${capability}`)
  if (!Object.values(PrivacyLevel).includes(input.privacy || PrivacyLevel.STANDARD)) throw new TypeError(`Invalid privacy level: ${input.privacy}`)
  if (input.reliability != null && (input.reliability < 0 || input.reliability > 1)) throw new TypeError('reliability must be between 0 and 1')
  return true
}

export function validateRouteRequest(input = {}) {
  const required = input.requiredCapabilities || []
  for (const capability of required) if (!Object.values(ModelCapability).includes(capability)) throw new TypeError(`Invalid required capability: ${capability}`)
  if (input.priority && !Object.values(RoutingPriority).includes(input.priority)) throw new TypeError(`Invalid routing priority: ${input.priority}`)
  if (input.privacy && !Object.values(PrivacyLevel).includes(input.privacy)) throw new TypeError(`Invalid route privacy: ${input.privacy}`)
  return true
}
