export const AgentCapability = Object.freeze({
  READ: 'read',
  PROPOSE: 'propose',
  WRITE: 'write',
  EXECUTE: 'execute',
  DEPLOY: 'deploy',
})

const VALID_CAPABILITIES = new Set(Object.values(AgentCapability))

export function assertAgentPermission({
  actor = 'agent',
  capability,
  branch,
  baseBranch = 'main',
  environment = 'preview',
  humanApproved = false,
} = {}) {
  if (!VALID_CAPABILITIES.has(capability)) throw new TypeError('Valid agent capability required')

  const isAgent = actor === 'agent'
  const isMutation = capability === AgentCapability.WRITE || capability === AgentCapability.EXECUTE || capability === AgentCapability.DEPLOY
  const isProduction = environment === 'production'

  if (isAgent && isMutation) {
    if (!branch || typeof branch !== 'string') throw new Error('Agent mutations require a dedicated branch')
    if (branch === baseBranch) throw new Error('Agent mutations on the base branch are forbidden')
  }

  if (capability === AgentCapability.DEPLOY && isProduction) {
    if (isAgent) throw new Error('Production deploy is human-only')
    if (!humanApproved) throw new Error('Production deploy requires explicit human approval')
  }

  return Object.freeze({
    allowed: true,
    actor,
    capability,
    branch: branch || null,
    environment,
    humanApprovalRequired: capability === AgentCapability.DEPLOY && isProduction,
  })
}
