export const RepoRadarDecision = Object.freeze({ KEEP:'KEEP', UPGRADE:'UPGRADE', REPLACE:'REPLACE', ADD:'ADD', REJECT:'REJECT', WATCH:'WATCH' })
export const RepoRadarGate = Object.freeze({ PASS:'PASS', FAIL:'FAIL', UNKNOWN:'UNKNOWN' })

const DECISIONS = new Set(Object.values(RepoRadarDecision))
const ALLOWED_LICENSES = new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','MPL-2.0'])
const WEIGHTS = Object.freeze({ security:.22, maintenance:.14, maturity:.10, tests:.10, compatibility:.14, performance:.08, rollback:.10, maintainability:.12 })
const clamp = (value) => Math.max(0, Math.min(1, Number(value)))
const score = (value, fallback=0) => Number.isFinite(Number(value)) ? clamp(value) : fallback
const gate = (value) => value===true||value===RepoRadarGate.PASS ? RepoRadarGate.PASS : value===false||value===RepoRadarGate.FAIL ? RepoRadarGate.FAIL : RepoRadarGate.UNKNOWN
const weightedScore = (evidence) => Object.entries(WEIGHTS).reduce((sum,[key,weight])=>sum+evidence[key]*weight,0)

export function validateRepoRadarCandidate(candidate){
  if(!candidate?.id||!candidate?.name||!candidate?.repository) throw new TypeError('Repo Radar candidate requires id, name and repository')
  if(!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(candidate.repository)) throw new TypeError(`Unsupported repository URL: ${candidate.repository}`)
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

export function evaluateRepoCandidate(candidate,{incumbent=null,minAddScore=.78,minReplaceDelta=.08}={}){
  validateRepoRadarCandidate(candidate)
  const evidence=normalizeEvidence(candidate)
  const gates={ security:gate(candidate.gates?.security), compatibility:gate(candidate.gates?.compatibility), benchmark:gate(candidate.gates?.benchmark), rollback:gate(candidate.gates?.rollback) }
  const blockers=[]
  const license=String(candidate.license||'').trim()
  if(candidate.archived===true) blockers.push('ARCHIVED_REPOSITORY')
  if(!license||!ALLOWED_LICENSES.has(license)) blockers.push('LICENSE_NOT_ALLOWED_OR_UNKNOWN')
  if(Number(candidate.criticalVulnerabilities||0)>0) blockers.push('KNOWN_CRITICAL_VULNERABILITY')
  if(candidate.maintained===false) blockers.push('UNMAINTAINED')
  if(gates.security===RepoRadarGate.FAIL) blockers.push('SECURITY_GATE_FAILED')
  if(gates.compatibility===RepoRadarGate.FAIL) blockers.push('COMPATIBILITY_GATE_FAILED')
  const total=weightedScore(evidence)
  const allPass=Object.values(gates).every((value)=>value===RepoRadarGate.PASS)
  const hasUnknown=Object.values(gates).some((value)=>value===RepoRadarGate.UNKNOWN)
  let decision=RepoRadarDecision.WATCH, reason='PROMISING_BUT_NOT_READY', superiorityDelta=null
  if(blockers.length){ decision=RepoRadarDecision.REJECT; reason=blockers[0] }
  else if(candidate.incumbent===true){ decision=candidate.upgrades?RepoRadarDecision.UPGRADE:RepoRadarDecision.KEEP; reason=candidate.upgrades?'SAFE_UPGRADE_CANDIDATE':'INCUMBENT_REMAINS_CANONICAL' }
  else if(candidate.replaces){
    if(!incumbent||incumbent.id!==candidate.replaces){ reason='REPLACEMENT_TARGET_NOT_VERIFIED' }
    else { superiorityDelta=total-incumbentScore(incumbent); if(allPass&&superiorityDelta>=minReplaceDelta){ decision=RepoRadarDecision.REPLACE; reason='MEASURABLY_SUPERIOR_WITH_SAFE_ROLLBACK' } else reason=hasUnknown?'REPLACEMENT_GATES_INCOMPLETE':'SUPERIORITY_NOT_DEMONSTRATED' }
  } else if(allPass&&total>=minAddScore){ decision=RepoRadarDecision.ADD; reason='ADOPTION_GATES_PASSED' }
  else reason=hasUnknown?'ADOPTION_GATES_INCOMPLETE':'BENEFIT_RISK_THRESHOLD_NOT_MET'
  return Object.freeze({ id:candidate.id,name:candidate.name,repository:candidate.repository,decision,reason,score:Number(total.toFixed(4)),superiorityDelta:superiorityDelta==null?null:Number(superiorityDelta.toFixed(4)),gates,blockers,evidence,stars:Number(candidate.stars||0),note:candidate.note||'',evaluatedAt:candidate.evaluatedAt||null,source:candidate.source||'CURATED' })
}

export function buildRepoRadarSnapshot(candidates=[],options={}){
  if(!Array.isArray(candidates)) throw new TypeError('candidates must be an array')
  const seen=new Set()
  const reports=candidates.map((candidate)=>{ if(seen.has(candidate.id)) throw new TypeError(`Duplicate Repo Radar candidate: ${candidate.id}`); seen.add(candidate.id); const incumbent=candidate.replaces?candidates.find((item)=>item.id===candidate.replaces)||null:null; return evaluateRepoCandidate(candidate,{...options,incumbent}) })
  const counts=Object.fromEntries(Object.values(RepoRadarDecision).map((value)=>[value,0])); for(const item of reports) counts[item.decision]++
  return Object.freeze({ generatedAt:new Date().toISOString(),candidates:reports.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)),counts,policy:Object.freeze({starsAreDiscoveryOnly:true,automaticInstall:false,automaticReplace:false,humanApprovalRequired:true}) })
}

export function assertSafeAdoption(report){
  if(!report?.decision) throw new TypeError('Repo Radar report is required')
  if(![RepoRadarDecision.ADD,RepoRadarDecision.REPLACE,RepoRadarDecision.UPGRADE].includes(report.decision)) return false
  if(report.blockers?.length) return false
  return Object.values(report.gates||{}).every((value)=>value===RepoRadarGate.PASS)
}
