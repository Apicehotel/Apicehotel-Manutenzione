import { RepoRadarDecision, evaluateRepoCandidate } from '../discovery/repo-radar.js'

export const OPEN_VIKING_CANDIDATE = Object.freeze({
  id: 'openviking',
  name: 'OpenViking',
  repository: 'https://github.com/volcengine/OpenViking',
  source: 'BLOCK_27_PINNED_REVIEW',
  evaluatedVersion: '0.3.22',
  evaluatedAt: '2026-09-04T00:00:00.000Z',
  license: 'AGPL-3.0',
  maintained: true,
  archived: false,
  replaces: 'rand-context-stack',
  criticalVulnerabilities: 0,
  gates: Object.freeze({ security: null, compatibility: false, benchmark: null, rollback: false }),
  evidence: Object.freeze({ security: .55, maintenance: .82, maturity: .48, tests: .72, compatibility: .24, performance: .65, rollback: .18, maintainability: .52 }),
  note: 'Useful tiered-context and retrieval-trace patterns; full runtime duplicates RandMind, RandGuide and Skill Engine.',
})

export const RAND_CONTEXT_INCUMBENT = Object.freeze({
  id: 'rand-context-stack',
  name: 'RandMind + RandGuide + Skill Engine',
  repository: 'https://github.com/Apicehotel/Apicehotel-Manutenzione',
  license: 'PROPRIETARY_INTERNAL',
  score: .91,
})

export function evaluateOpenViking(candidate = OPEN_VIKING_CANDIDATE) {
  const report = evaluateRepoCandidate(candidate, { incumbent: RAND_CONTEXT_INCUMBENT })
  const duplicatedAuthorities = Object.freeze(['memory', 'knowledge', 'skills', 'retrieval', 'session-context'])
  const operationalCosts = Object.freeze(['python-service', 'context-database', 'provider-credentials', 'new-observability-plane'])
  const adoptablePatterns = Object.freeze(['tiered-context-loading', 'observable-retrieval-trace'])
  return Object.freeze({
    schema: 'rand.viking-evaluation.v1',
    candidate: Object.freeze({ id: candidate.id, repository: candidate.repository, version: candidate.evaluatedVersion }),
    report,
    duplicatedAuthorities,
    operationalCosts,
    adoptablePatterns,
    decision: report.decision === RepoRadarDecision.REJECT ? 'ADOPT_PATTERNS_ONLY' : 'HUMAN_REVIEW_REQUIRED',
    installAllowed: false,
    canonicalAuthorities: Object.freeze(['RandMind', 'RandGuide', 'SkillEngine', 'AuthorizedContextEngine']),
  })
}

export function assertVikingEvaluation(result = evaluateOpenViking()) {
  if (result.installAllowed) throw new Error('VIKING_UNSAFE_INSTALL_APPROVAL')
  if (result.report.decision !== RepoRadarDecision.REJECT) throw new Error('VIKING_EVALUATION_NOT_FAIL_CLOSED')
  if (!result.duplicatedAuthorities.length || !result.adoptablePatterns.length) throw new Error('VIKING_EVALUATION_INCOMPLETE')
  return true
}
