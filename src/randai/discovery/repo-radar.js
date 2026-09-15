export const RepoRadarDecision = Object.freeze({ KEEP:'KEEP', UPGRADE:'UPGRADE', REPLACE:'REPLACE', ADD:'ADD', REJECT:'REJECT', WATCH:'WATCH' })
export const RepoRadarGate = Object.freeze({ PASS:'PASS', FAIL:'FAIL', UNKNOWN:'UNKNOWN' })
export const RepoRadarUsageMode = Object.freeze({
  DIRECT_INTEGRATION:'DIRECT_INTEGRATION',
  INTERNAL_EVALUATION:'INTERNAL_EVALUATION',
  REFERENCE_ONLY:'REFERENCE_ONLY',
  SEPARATE_SERVICE:'SEPARATE_SERVICE',
})

const DECISIONS = new Set(Object.values(RepoRadarDecision))
const PERMISSIVE_LICENSES = new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','MPL-2.0'])
const COPYLEFT_LICENSES = new Set(['GPL-2.0','GPL-2.0-only','GPL-2.0-or-later','GPL-3.0','GPL-3.0-only','GPL-3.0-or-later','AGPL-3.0','AGPL-3.0-only','AGPL-3.0-or-later','LGPL-2.1','LGPL-2.1-only','LGPL-2.1-or-later','LGPL-3.0','LGPL-3.0-only','LGPL-3.0-or-later','EUPL-1.2'])
const REVIEWABLE_COPYLEFT_MODES = new Set([RepoRadarUsageMode.INTERNAL_EVALUATION,RepoRadarUsageMode.REFERENCE_ONLY,RepoRadarUsageMode.SEPARATE_SERVICE])
const SUPPORTED_REPOSITORY_HOSTS = new Set(['github.com','gitlab.com','codeberg.org','gitea.com','code.forgejo.org','bitbucket.org','git.sr.ht','gitee.com','huggingface.co','open-vsx.org','crates.io','www.npmjs.com','npmjs.com','pypi.org','pub.dev'])
const WEIGHTS = Object.freeze({ security:.22, maintenance:.14, maturity:.10, tests:.10, compatibility:.14, performance:.08, rollback:.10, maintainability:.12 })
const clamp = (value) => Math.max(0, Math.min(1, Number(value)))
const score = (value, fallback=0) => Number.isFinite(Number(value)) ? clamp(value) : fallback
const gate = (value) => value===true||value===RepoRadarGate.PASS ? RepoRadarGate.PASS : value===false||value===RepoRadarGate.FAIL ? RepoRadarGate.FAIL : RepoRadarGate.UNKNOWN
const weightedScore = (evidence) => Object.entries(WEIGHTS).reduce((sum,[key,weight])=>sum+evidence[key]*weight,0)

function isSupportedRepositoryUrl(repository){
  try{
    const url=new URL(repository)
    if(url.protocol!=='https:'||!SUPPORTED_REPOSITORY_HOSTS.has(url.hostname.toLowerCase())) return false
    const parts=url.pathname.split('/').filter(Boolean)
    return parts.length>=2
  }catch{return false}
}

export function validateRepoRadarCandidate(candidate){
  if(!candidate?.id||!candidate?.name||!candidate?.repository) throw new TypeError('Repo Radar candidate requires id, name and repository')
  if(!isSupportedRepositoryUrl(candidate.repository)) throw new TypeError(`Unsupported repository URL: ${candidate.repository}`)
  if(candidate.decision&&!DECISIONS.has(candidate.decision)) throw new TypeError(`Invalid Repo Radar decision: ${candidate.decision}`)
  return true
}

function normalizeEvidence(candidate={}){
  const e=candidate.evidence||{}
  return { security:score(e.security), maintenance:score(e.maintenance), maturity:score(e.maturity), tests:score(e.tests), compatibility:score(e.compatibility), performance:score(e.performance,.5), rollback:score(e.rollback), maintainability:score(e.maintainability) }
}

function incumbentScore(incumbent){
  if(!incumbent) return 0
  if(Number.isFinite(Number(incumbent.score))) return score(incumbent.score)
  return weightedScore(normalizeEvidence(incumbent))
}

function evaluateLicense(candidate){
  const license=String(candidate.license||'').trim()
  const usageMode=candidate.usageMode||RepoRadarUsageMode.DIRECT_INTEGRATION
  if(PERMISSIVE_LICENSES.has(license)) return { license, usageMode, status:'PERMISSIVE', reviewRequired:false, approved:true, blocker:null }
  if(COPYLEFT_LICENSES.has(license)){
    if(REVIEWABLE_COPYLEFT_MODES.has(usageMode)) return { license, usageMode, status:'COPYLEFT_REVIEW', reviewRequired:true, approved:candidate.licenseApproved===true, blocker:null }
    return { license, usageMode, status:'COPYLEFT_BOUNDARY_REQUIRED', reviewRequired:true, approved:false, blocker:'COPYLEFT_LICENSE_REQUIRES_USAGE_BOUNDARY' }
  }
  return { license, usageMode, status:'UNKNOWN_OR_UNSUPPORTED', reviewRequired:true, approved:false, blocker:'LICENSE_NOT_ALLOWED_OR_UNKNOWN' }
}

export function evaluateRepoCandidate(candidate,{incumbent=null,minAddScore=.78,minReplaceDelta=.08}={}){
  validateRepoRadarCandidate(candidate)
  const evidence=normalizeEvidence(candidate)
  const gates={ security:gate(candidate.gates?.security), compatibility:gate(candidate.gates?.compatibility), benchmark:gate(candidate.gates?.benchmark), rollback:gate(candidate.gates?.rollback) }
  const licenseAssessment=evaluateLicense(candidate)
  const blockers=[]
  if(candidate.archived===true) blockers.push('ARCHIVED_REPOSITORY')
  if(licenseAssessment.blocker) blockers.push(licenseAssessment.blocker)
  if(Number(candidate.criticalVulnerabilities||0)>0) blockers.push('KNOWN_CRITICAL_VULNERABILITY')
  if(candidate.maintained===false) blockers.push('UNMAINTAINED')
  if(gates.security===RepoRadarGate.FAIL) blockers.push('SECURITY_GATE_FAILED')
  if(gates.compatibility===RepoRadarGate.FAIL) blockers.push('COMPATIBILITY_GATE_FAILED')
  const total=weightedScore(evidence)
  const allPass=Object.values(gates).every((value)=>value===RepoRadarGate.PASS)
  const hasUnknown=Object.values(gates).some((value)=>value===RepoRadarGate.UNKNOWN)
  const licenseReady=!licenseAssessment.reviewRequired||licenseAssessment.approved
  let decision=RepoRadarDecision.WATCH, reason='PROMISING_BUT_NOT_READY', superiorityDelta=null
  if(blockers.length){ decision=RepoRadarDecision.REJECT; reason=blockers[0] }
  else if(!licenseReady){ reason='LICENSE_REVIEW_REQUIRED' }
  else if(candidate.incumbent===true){ decision=candidate.upgrades?RepoRadarDecision.UPGRADE:RepoRadarDecision.KEEP; reason=candidate.upgrades?'SAFE_UPGRADE_CANDIDATE':'INCUMBENT_REMAINS_CANONICAL' }
  else if(candidate.replaces){
    if(!incumbent||incumbent.id!==candidate.replaces){ reason='REPLACEMENT_TARGET_NOT_VERIFIED' }
    else { superiorityDelta=total-incumbentScore(incumbent); if(allPass&&superiorityDelta>=minReplaceDelta){ decision=RepoRadarDecision.REPLACE; reason='MEASURABLY_SUPERIOR_WITH_SAFE_ROLLBACK' } else reason=hasUnknown?'REPLACEMENT_GATES_INCOMPLETE':'SUPERIORITY_NOT_DEMONSTRATED' }
  } else if(allPass&&total>=minAddScore){ decision=RepoRadarDecision.ADD; reason='ADOPTION_GATES_PASSED' }
  else reason=hasUnknown?'ADOPTION_GATES_INCOMPLETE':'BENEFIT_RISK_THRESHOLD_NOT_MET'
  return Object.freeze({
    id:candidate.id,
    name:candidate.name,
    repository:candidate.repository,
    decision,
    reason,
    score:Number(total.toFixed(4)),
    superiorityDelta:superiorityDelta==null?null:Number(superiorityDelta.toFixed(4)),
    gates,
    blockers,
    evidence,
    license:licenseAssessment.license,
    licenseStatus:licenseAssessment.status,
    licenseReviewRequired:licenseAssessment.reviewRequired,
    licenseApproved:licenseAssessment.approved,
    usageMode:licenseAssessment.usageMode,
    stars:Number(candidate.stars||0),
    note:candidate.note||'',
    evaluatedAt:candidate.evaluatedAt||null,
    source:candidate.source||'CURATED',
    sourcePlatform:candidate.sourcePlatform||'GITHUB',
    category:candidate.category||null,
    sector:candidate.sector||null,
    capability:candidate.capability||null,
    discoveryScore:Number.isFinite(Number(candidate.discoveryScore))?Number(candidate.discoveryScore):null,
    discovery:candidate.discovery||null,
    repositoryMeta:candidate.repositoryMeta||candidate.github||null,
  })
}

export function buildRepoRadarSnapshot(candidates=[],options={}){
  if(!Array.isArray(candidates)) throw new TypeError('candidates must be an array')
  const seen=new Set()
  const reports=candidates.map((candidate)=>{ if(seen.has(candidate.id)) throw new TypeError(`Duplicate Repo Radar candidate: ${candidate.id}`); seen.add(candidate.id); const incumbent=candidate.replaces?candidates.find((item)=>item.id===candidate.replaces)||null:null; return evaluateRepoCandidate(candidate,{...options,incumbent}) })
  const counts=Object.fromEntries(Object.values(RepoRadarDecision).map((value)=>[value,0])); for(const item of reports) counts[item.decision]++
  return Object.freeze({
    generatedAt:new Date().toISOString(),
    candidates:reports.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)),
    counts,
    policy:Object.freeze({
      starsAreDiscoveryOnly:true,
      automaticInstall:false,
      automaticReplace:false,
      humanApprovalRequired:true,
      multiSourceDiscovery:true,
      sectorCoverage:true,
      internalNonCommercialContext:true,
      copyleftRequiresUsageBoundary:true,
      supportedRepositoryHosts:Object.freeze([...SUPPORTED_REPOSITORY_HOSTS]),
    }),
  })
}

export function assertSafeAdoption(report){
  if(!report?.decision) throw new TypeError('Repo Radar report is required')
  if(![RepoRadarDecision.ADD,RepoRadarDecision.REPLACE,RepoRadarDecision.UPGRADE].includes(report.decision)) return false
  if(report.blockers?.length) return false
  if(report.licenseReviewRequired&&!report.licenseApproved) return false
  return Object.values(report.gates||{}).every((value)=>value===RepoRadarGate.PASS)
}
