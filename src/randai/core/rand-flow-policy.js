export const RandFlowStage = Object.freeze({
  DISCOVER: 'DISCOVER',
  PLAN: 'PLAN',
  IMPLEMENT: 'IMPLEMENT',
  TEST: 'TEST',
  SECURITY: 'SECURITY',
  REVIEW: 'REVIEW',
  READY_FOR_HUMAN_MERGE: 'READY_FOR_HUMAN_MERGE',
})

export const RAND_FLOW_STAGES = Object.freeze([
  RandFlowStage.DISCOVER,
  RandFlowStage.PLAN,
  RandFlowStage.IMPLEMENT,
  RandFlowStage.TEST,
  RandFlowStage.SECURITY,
  RandFlowStage.REVIEW,
  RandFlowStage.READY_FOR_HUMAN_MERGE,
])

export function buildRandFlowPolicy({ branch, baseBranch = 'main', agentGenerated = true } = {}) {
  if (!branch || typeof branch !== 'string') throw new TypeError('RandFlow requires a dedicated branch')
  if (branch === baseBranch) throw new Error('RandFlow forbids agent work directly on the base branch')
  return Object.freeze({
    version: 'RAND_FLOW_V1',
    branch,
    baseBranch,
    agentGenerated: Boolean(agentGenerated),
    stages: RAND_FLOW_STAGES,
    testDrivenWherePractical: true,
    systematicDebugging: true,
    evidenceBeforeCompletion: true,
    minimalCoherentChange: true,
    directMainPush: false,
    automaticMerge: false,
    humanApprovalRequired: true,
    productionDeployBeforeApproval: false,
  })
}

export function assertRandFlowReadyForHumanReview({ policy, testsPassed, securityPassed, ciPassed, unresolved = [] } = {}) {
  if (!policy || policy.version !== 'RAND_FLOW_V1') throw new TypeError('Valid RandFlow policy required')
  if (policy.directMainPush !== false || policy.automaticMerge !== false || policy.humanApprovalRequired !== true) {
    throw new Error('RandFlow governance boundary violated')
  }
  if (!testsPassed) throw new Error('Tests must pass before human review')
  if (!securityPassed) throw new Error('Security gates must pass before human review')
  if (!ciPassed) throw new Error('CI must pass before human review')
  if (Array.isArray(unresolved) && unresolved.length > 0) throw new Error('Unresolved work remains')
  return Object.freeze({ ready: true, stage: RandFlowStage.READY_FOR_HUMAN_MERGE, humanApprovalRequired: true })
}
