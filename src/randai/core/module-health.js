import { EcosystemStatus } from './ecosystem.js'
import { RepoRadarDecision } from '../discovery/repo-radar.js'

export function buildModuleHealthSnapshot({ modules = [], repoSnapshot = null, healthCheck = null } = {}) {
  const moduleCounts = Object.fromEntries(Object.values(EcosystemStatus).map((status) => [status, 0]))
  for (const module of modules) moduleCounts[module.status] = (moduleCounts[module.status] || 0) + 1

  const repoCounts = Object.fromEntries(Object.values(RepoRadarDecision).map((decision) => [decision, 0]))
  for (const candidate of repoSnapshot?.candidates || []) repoCounts[candidate.decision] = (repoCounts[candidate.decision] || 0) + 1

  const blockers = []
  if (healthCheck?.status === 'CRITICAL') blockers.push('CORE_HEALTH_CRITICAL')
  if ((moduleCounts.ZOMBIE || 0) > 0) blockers.push('ZOMBIE_MODULES_PRESENT')
  if ((repoCounts.REJECT || 0) > 0) blockers.push('REJECTED_REPOSITORY_CANDIDATES')

  const unfinished = (moduleCounts.PARTIAL || 0) + (moduleCounts.BACKEND_ONLY || 0) + (moduleCounts.PLANNED || 0)
  const state = blockers.includes('CORE_HEALTH_CRITICAL') ? 'CRITICAL' : unfinished > 0 ? 'EVOLVING' : 'STABLE'

  return Object.freeze({
    state,
    moduleCounts: Object.freeze(moduleCounts),
    repoCounts: Object.freeze(repoCounts),
    unfinished,
    blockers: Object.freeze(blockers),
    policy: Object.freeze({ unknownIsHealthy: false, repoDecisionIsNotInstallation: true, liveRequiresEvidence: true }),
  })
}
