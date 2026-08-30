export const DiscoveryKind = Object.freeze({ SKILL: 'SKILL', TOOL: 'TOOL', MCP: 'MCP', LIBRARY: 'LIBRARY' })
export const DiscoveryStatus = Object.freeze({ DISCOVERED: 'DISCOVERED', ANALYZED: 'ANALYZED', SANDBOXED: 'SANDBOXED', EVALUATED: 'EVALUATED', RECOMMENDED: 'RECOMMENDED', REJECTED: 'REJECTED' })
export const DiscoveryDecision = Object.freeze({ REVIEW: 'REVIEW', SANDBOX: 'SANDBOX', RECOMMEND: 'RECOMMEND', REJECT: 'REJECT' })

const VALID_KINDS = new Set(Object.values(DiscoveryKind))

export function validateDiscoveryCandidate(candidate) {
  if (!candidate?.id || !candidate?.name || !candidate?.source?.id) throw new TypeError('Discovery candidate requires id, name and source.id')
  if (!VALID_KINDS.has(candidate.kind)) throw new TypeError(`Invalid discovery kind: ${candidate.kind}`)
  if (!candidate.source.ref) throw new TypeError('Discovery candidate requires source.ref')
  return true
}
