import {
  authorizeToolCall,
  createToolPolicyRegistry,
} from '../../src/randai/core/tool-gateway.js'

const registry = createToolPolicyRegistry({
  'maintenance.read': {
    risk: 'LOW',
    scopes: ['maintenance:read'],
    hotelScoped: true,
    mutation: false,
    enabled: true,
  },
  'maintenance.write': {
    risk: 'HIGH',
    scopes: ['maintenance:write'],
    hotelScoped: true,
    mutation: true,
    enabled: true,
  },
  'admin.destructive': {
    risk: 'CRITICAL',
    scopes: ['admin:destructive'],
    hotelScoped: true,
    mutation: true,
    enabled: false,
  },
})

function scopes(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default class RandAISecurityProvider {
  id() {
    return 'randai-security-boundary'
  }

  async callApi(_prompt, context = {}) {
    const vars = context?.vars || {}
    const decision = authorizeToolCall({
      toolName: vars.toolName,
      registry,
      actor: vars.actorId ? { id: vars.actorId } : null,
      hotelId: vars.hotelId,
      targetHotelId: vars.targetHotelId,
      grantedScopes: scopes(vars.grantedScopes),
    })

    return {
      output: decision.code,
      metadata: {
        allowed: decision.allowed,
        tool: decision.tool,
      },
    }
  }
}
