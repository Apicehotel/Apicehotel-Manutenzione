import { SkillRisk } from '../skills/contracts.js'

export const LearningPromotionMode = Object.freeze({
  AUTO: 'AUTO',
  REVIEW: 'REVIEW',
  BLOCKED: 'BLOCKED',
})

export function learningPromotionDecision({ risk = SkillRisk.LOW, tested = false, evidenceCount = 0, changesAuthorization = false, changesSchema = false, destructive = false } = {}) {
  if (!tested || evidenceCount < 2) return { mode: LearningPromotionMode.BLOCKED, reason: 'INSUFFICIENT_VERIFIED_EVIDENCE' }
  if (changesAuthorization || changesSchema || destructive || risk === SkillRisk.CRITICAL || risk === SkillRisk.HIGH) {
    return { mode: LearningPromotionMode.REVIEW, reason: 'HUMAN_APPROVAL_REQUIRED' }
  }
  if (risk === SkillRisk.MEDIUM) return { mode: LearningPromotionMode.REVIEW, reason: 'OPERATIONAL_REVIEW_REQUIRED' }
  return { mode: LearningPromotionMode.AUTO, reason: 'LOW_RISK_TESTED_IMPROVEMENT' }
}
