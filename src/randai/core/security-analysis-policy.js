export const SecurityAnalysisStage = Object.freeze({
  TRIAGE: 'TRIAGE',
  STATIC: 'STATIC',
  DYNAMIC: 'DYNAMIC',
  SYNTHESIS: 'SYNTHESIS',
})

export function buildSecurityAnalysisPlan({ artifactType, authorization, isolated = false, production = false } = {}) {
  if (!String(artifactType || '').trim()) throw new TypeError('artifactType is required')
  if (authorization !== true) throw new Error('Security analysis requires explicit authorization')
  if (!isolated || production) throw new Error('Reverse analysis is sandbox-only and forbidden in production')
  return Object.freeze({
    artifactType: String(artifactType),
    stages: Object.freeze([
      SecurityAnalysisStage.TRIAGE,
      SecurityAnalysisStage.STATIC,
      SecurityAnalysisStage.DYNAMIC,
      SecurityAnalysisStage.SYNTHESIS,
    ]),
    networkAccess: 'DENY_BY_DEFAULT',
    secrets: 'FORBIDDEN',
    productionCredentials: 'FORBIDDEN',
    automaticExploitExecution: false,
    sourcePattern: 'reverse-skill',
  })
}
