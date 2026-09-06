import { SkillRisk, SkillStatus } from './contracts.js'
import { learningPromotionDecision, LearningPromotionMode } from '../learning/promotion-policy.js'

export const SkillGovernanceAction = Object.freeze({
  KEEP: 'KEEP',
  AUTO_APPROVE_ELIGIBLE: 'AUTO_APPROVE_ELIGIBLE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  DEPRECATION_REVIEW: 'DEPRECATION_REVIEW',
  ZOMBIE_CANDIDATE: 'ZOMBIE_CANDIDATE',
})

const DAY_MS = 24 * 60 * 60 * 1000
const unique = (values = []) => [...new Set(values)]
const clone = (value) => value == null ? value : structuredClone(value)

function asCount(value) {
  const count = Number(value ?? 0)
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0
}

function ageDays(value, nowMs) {
  if (!value) return null
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.floor((nowMs - time) / DAY_MS))
}

function normalizeTelemetry(input = {}) {
  const usageCount = asCount(input.usageCount)
  const successCount = Math.min(usageCount, asCount(input.successCount))
  const failureCount = Math.min(usageCount, asCount(input.failureCount))
  return Object.freeze({
    usageCount,
    successCount,
    failureCount,
    fallbackCount: asCount(input.fallbackCount),
    verifiedEvidenceCount: asCount(input.verifiedEvidenceCount),
    referenceCount: asCount(input.referenceCount),
    lastUsedAt: input.lastUsedAt || null,
    replacementSkillId: input.replacementSkillId || null,
    changesAuthorization: input.changesAuthorization === true,
    changesSchema: input.changesSchema === true,
    destructive: input.destructive === true,
  })
}

function overlapRatio(a = [], b = []) {
  const left = new Set(a)
  const right = new Set(b)
  const union = new Set([...left, ...right])
  if (!union.size) return 0
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  return intersection / union.size
}

function routingKeywords(skill) {
  return skill?.metadata?.routing?.keywords || []
}

function overlapScore(a, b) {
  const tags = overlapRatio(a.tags, b.tags)
  const tools = overlapRatio(a.requiredTools, b.requiredTools)
  const keywords = overlapRatio(routingKeywords(a), routingKeywords(b))
  return Number((tags * 0.25 + tools * 0.35 + keywords * 0.4).toFixed(2))
}

export function assessSkillLifecycle(skill, telemetry = {}, { now = new Date(), staleAfterDays = 90 } = {}) {
  if (!skill?.id || !skill?.status) throw new TypeError('skill is required')
  const evidence = normalizeTelemetry(telemetry)
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now)
  if (!Number.isFinite(nowMs)) throw new TypeError('Invalid governance clock')
  const daysSinceUse = ageDays(evidence.lastUsedAt, nowMs)
  const stale = evidence.usageCount === 0 || (daysSinceUse != null && daysSinceUse >= staleAfterDays)
  const successRate = evidence.usageCount ? Number((evidence.successCount / evidence.usageCount).toFixed(3)) : null

  const promotion = learningPromotionDecision({
    risk: skill.risk || SkillRisk.LOW,
    tested: skill.status === SkillStatus.TESTED,
    evidenceCount: evidence.verifiedEvidenceCount,
    changesAuthorization: evidence.changesAuthorization,
    changesSchema: evidence.changesSchema,
    destructive: evidence.destructive,
  })

  let action = SkillGovernanceAction.KEEP
  let reason = 'HEALTHY_OR_INSUFFICIENT_SIGNAL'

  if ([SkillStatus.DEPRECATED, SkillStatus.BLOCKED].includes(skill.status)) {
    if (evidence.usageCount === 0 && evidence.referenceCount === 0 && evidence.replacementSkillId) {
      action = SkillGovernanceAction.ZOMBIE_CANDIDATE
      reason = 'INACTIVE_UNREFERENCED_WITH_REPLACEMENT'
    } else {
      action = SkillGovernanceAction.DEPRECATION_REVIEW
      reason = 'RETIRED_BUT_STILL_REFERENCED_OR_WITHOUT_REPLACEMENT'
    }
  } else if (skill.status === SkillStatus.TESTED && promotion.mode === LearningPromotionMode.AUTO) {
    action = SkillGovernanceAction.AUTO_APPROVE_ELIGIBLE
    reason = promotion.reason
  } else if (skill.status === SkillStatus.TESTED && promotion.mode === LearningPromotionMode.REVIEW) {
    action = SkillGovernanceAction.REVIEW_REQUIRED
    reason = promotion.reason
  } else if (stale && skill.status === SkillStatus.APPROVED) {
    action = SkillGovernanceAction.REVIEW_REQUIRED
    reason = 'APPROVED_SKILL_STALE_REVIEW_ONLY'
  }

  return Object.freeze({
    skillId: skill.id,
    version: skill.version,
    status: skill.status,
    risk: skill.risk,
    action,
    reason,
    stale,
    daysSinceUse,
    successRate,
    telemetry: evidence,
    promotion: Object.freeze({ ...promotion }),
  })
}

export class RandSkillGovernance {
  constructor({ skillRegistry, staleAfterDays = 90, overlapThreshold = 0.72 } = {}) {
    if (!skillRegistry?.list || !skillRegistry?.inspect || !skillRegistry?.transition) throw new TypeError('RandSkillGovernance requires skillRegistry')
    this.skillRegistry = skillRegistry
    this.staleAfterDays = staleAfterDays
    this.overlapThreshold = overlapThreshold
  }

  snapshot({ telemetry = {}, now = new Date() } = {}) {
    const skills = this.skillRegistry.list().map((summary) => this.skillRegistry.inspect(summary.id, summary.version)).filter(Boolean)
    const assessments = skills.map((skill) => assessSkillLifecycle(skill, telemetry[skill.id] || telemetry[`${skill.id}@${skill.version}`] || {}, { now, staleAfterDays: this.staleAfterDays }))
    const overlaps = []
    for (let i = 0; i < skills.length; i += 1) {
      for (let j = i + 1; j < skills.length; j += 1) {
        const score = overlapScore(skills[i], skills[j])
        if (score >= this.overlapThreshold) overlaps.push(Object.freeze({ skillIds: Object.freeze([skills[i].id, skills[j].id]), score, action: SkillGovernanceAction.REVIEW_REQUIRED }))
      }
    }
    return Object.freeze({
      generatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
      skills: Object.freeze(assessments),
      overlaps: Object.freeze(overlaps),
      summary: Object.freeze({
        total: assessments.length,
        reviewRequired: assessments.filter((item) => item.action === SkillGovernanceAction.REVIEW_REQUIRED || item.action === SkillGovernanceAction.DEPRECATION_REVIEW).length,
        autoApproveEligible: assessments.filter((item) => item.action === SkillGovernanceAction.AUTO_APPROVE_ELIGIBLE).length,
        zombieCandidates: assessments.filter((item) => item.action === SkillGovernanceAction.ZOMBIE_CANDIDATE).length,
        overlapCandidates: overlaps.length,
      }),
    })
  }

  autoApprove({ id, version, telemetry = {} } = {}) {
    const skill = this.skillRegistry.inspect(id, version)
    if (!skill) throw new Error(`Unknown skill: ${id}@${version || 'latest'}`)
    const assessment = assessSkillLifecycle(skill, telemetry, { staleAfterDays: this.staleAfterDays })
    if (assessment.action !== SkillGovernanceAction.AUTO_APPROVE_ELIGIBLE) {
      throw new Error(`Skill is not eligible for automatic approval: ${assessment.reason}`)
    }
    return Object.freeze({ skill: this.skillRegistry.transition(skill.id, skill.version, SkillStatus.APPROVED), assessment })
  }
}

export function summarizeSkillGovernance(snapshot) {
  if (!snapshot?.summary) throw new TypeError('governance snapshot is required')
  return Object.freeze({
    ...clone(snapshot.summary),
    actions: Object.freeze(unique((snapshot.skills || []).map((item) => item.action))),
  })
}
