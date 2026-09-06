const DEFAULT_TOOL_POLICY = Object.freeze({
  risk: 'HIGH',
  scopes: [],
  hotelScoped: true,
  mutation: true,
  enabled: false,
})

const ALLOWED_RISKS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
}

function normalizePolicy(name, raw = {}) {
  const risk = String(raw.risk || DEFAULT_TOOL_POLICY.risk).toUpperCase()
  return Object.freeze({
    name,
    risk: ALLOWED_RISKS.has(risk) ? risk : DEFAULT_TOOL_POLICY.risk,
    scopes: Object.freeze(normalizeList(raw.scopes)),
    hotelScoped: raw.hotelScoped !== false,
    mutation: raw.mutation !== false,
    enabled: raw.enabled === true,
  })
}

export function createToolPolicyRegistry(entries = {}) {
  const normalized = {}
  for (const [name, policy] of Object.entries(entries || {})) {
    const toolName = String(name || '').trim()
    if (!toolName) continue
    normalized[toolName] = normalizePolicy(toolName, policy)
  }
  return Object.freeze(normalized)
}

function deny(code, reason, tool = null) {
  return Object.freeze({ allowed: false, code, reason, tool })
}

export function authorizeToolCall({
  toolName,
  registry,
  actor,
  hotelId,
  targetHotelId,
  grantedScopes = [],
} = {}) {
  const name = String(toolName || '').trim()
  if (!name) return deny('TOOL_NAME_REQUIRED', 'Tool non specificato.')

  const policy = registry?.[name]
  if (!policy) return deny('TOOL_NOT_REGISTERED', 'Tool non registrato nel RandTool Gateway.', name)
  if (!policy.enabled) return deny('TOOL_DISABLED', 'Tool disabilitato dalla policy RandCore.', name)
  if (!actor?.id) return deny('ACTOR_REQUIRED', 'Identità del caller obbligatoria.', name)

  const sourceHotel = String(hotelId || '').trim()
  const destinationHotel = String(targetHotelId || sourceHotel).trim()

  if (policy.hotelScoped) {
    if (!sourceHotel || !destinationHotel) {
      return deny('HOTEL_SCOPE_REQUIRED', 'Scope hotel obbligatorio per il tool.', name)
    }
    if (sourceHotel !== destinationHotel) {
      return deny('CROSS_HOTEL_DENIED', 'Accesso cross-hotel vietato dal RandTool Gateway.', name)
    }
  }

  const granted = new Set(normalizeList(grantedScopes))
  const missing = policy.scopes.filter((scope) => !granted.has(scope))
  if (missing.length) {
    return Object.freeze({
      allowed: false,
      code: 'SCOPE_DENIED',
      reason: 'Permessi insufficienti per il tool.',
      tool: name,
      missingScopes: Object.freeze(missing),
    })
  }

  return Object.freeze({
    allowed: true,
    code: 'ALLOW',
    reason: 'Tool autorizzato entro i confini RandCore.',
    tool: name,
    risk: policy.risk,
    hotelScoped: policy.hotelScoped,
    mutation: policy.mutation,
  })
}

export function listExposedTools({ registry, actor, hotelId, grantedScopes = [] } = {}) {
  if (!actor?.id || !hotelId) return []
  return Object.values(registry || {})
    .filter((policy) => authorizeToolCall({
      toolName: policy.name,
      registry,
      actor,
      hotelId,
      targetHotelId: hotelId,
      grantedScopes,
    }).allowed)
    .map((policy) => policy.name)
    .sort()
}
