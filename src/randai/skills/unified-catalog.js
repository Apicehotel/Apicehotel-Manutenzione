import mcpRegistry from '../../../config/mcp/registry.json' with { type: 'json' }
import { canonicalRandSkillDefinitions } from './canonical.js'
import { RAND_ECOSYSTEM_COMPONENTS } from '../control-center/agent-registry.js'

const clean = (value) => String(value ?? '').trim()

function freezeList(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)))
}

export const UnifiedCapabilityKind = Object.freeze({
  SKILL: 'skill',
  MCP: 'mcp',
})

export function buildUnifiedRandCapabilityCatalog({
  skills = canonicalRandSkillDefinitions(),
  mcp = mcpRegistry,
  components = RAND_ECOSYSTEM_COMPONENTS,
} = {}) {
  const agentIds = new Set((components || []).map((component) => component.id))
  const skillItems = (skills || []).map((skill) => ({
    key: `skill:${skill.id}`,
    kind: UnifiedCapabilityKind.SKILL,
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    status: skill.status,
    risk: skill.risk,
    invocation: skill.invocation,
    source: skill.metadata?.source || null,
    governedBy: skill.metadata?.governedBy || 'RandCore',
    tags: [...(skill.tags || [])],
    permissions: [...(skill.permissions || [])],
    requiredTools: [...(skill.requiredTools || [])],
    profiles: [],
    capabilities: [],
  }))

  const profileMembership = new Map()
  for (const [profile, serverIds] of Object.entries(mcp?.profiles || {})) {
    for (const id of serverIds || []) {
      const set = profileMembership.get(id) || new Set()
      set.add(profile)
      profileMembership.set(id, set)
    }
  }

  const mcpItems = (mcp?.servers || []).map((server) => ({
    key: `mcp:${server.id}`,
    kind: UnifiedCapabilityKind.MCP,
    id: server.id,
    name: server.title || server.id,
    description: server.purpose || '',
    version: null,
    status: 'REGISTERED',
    risk: server.mode === 'governed-write' ? 'HIGH' : 'LOW',
    invocation: null,
    source: clean(server.url || server.endpointEnv || server.command) || null,
    governedBy: server.authority || 'Rand MCP policy',
    tags: [server.placement, server.mode].filter(Boolean),
    permissions: server.mode === 'governed-write' ? ['WRITE_PROTECTED'] : ['READ'],
    requiredTools: [],
    profiles: [...(profileMembership.get(server.id) || [])].sort(),
    capabilities: [...(server.capabilities || [])],
  }))

  const profiles = Object.entries(mcp?.profiles || {}).map(([id, serverIds]) => ({
    id,
    serverIds: [...serverIds],
    knownServers: serverIds.filter((serverId) => mcpItems.some((item) => item.id === serverId)),
  }))

  return Object.freeze({
    version: Object.freeze({
      skills: skills?.[0]?.version || null,
      mcp: mcp?.version || null,
    }),
    items: freezeList([...skillItems, ...mcpItems]),
    skills: freezeList(skillItems),
    mcp: freezeList(mcpItems),
    profiles: freezeList(profiles),
    agents: freezeList((components || []).filter((component) => agentIds.has(component.id)).map((component) => ({
      id: component.id,
      name: component.name,
      kind: component.kind,
      runtime: Boolean(component.runtime),
      role: component.role,
    }))),
  })
}

export function filterUnifiedRandCapabilityCatalog(catalog, {
  kind = 'all',
  query = '',
  profile = 'all',
} = {}) {
  const needle = clean(query).toLowerCase()
  return (catalog?.items || []).filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false
    if (profile !== 'all' && !item.profiles.includes(profile)) return false
    if (!needle) return true
    return [
      item.id, item.name, item.description, item.source,
      ...(item.tags || []), ...(item.capabilities || []), ...(item.requiredTools || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(needle)
  })
}

export function summarizeUnifiedRandCapabilityCatalog(catalog, liveMcpStatus = []) {
  const byServer = new Map((liveMcpStatus || []).map((server) => [server.serverId, server]))
  const mcp = (catalog?.mcp || []).map((item) => ({
    ...item,
    live: byServer.get(item.id) || null,
  }))
  return Object.freeze({
    skillCount: catalog?.skills?.length || 0,
    mcpCount: catalog?.mcp?.length || 0,
    profileCount: catalog?.profiles?.length || 0,
    enabledMcpCount: mcp.filter((item) => item.live?.enabled === true).length,
    configuredMcpCount: mcp.filter((item) => item.live?.credentialsReady === true).length,
    mcp,
  })
}
