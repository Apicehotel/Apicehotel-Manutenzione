export const SkillStatus = Object.freeze({
  DRAFT: 'DRAFT',
  CANDIDATE: 'CANDIDATE',
  TESTED: 'TESTED',
  APPROVED: 'APPROVED',
  DEPRECATED: 'DEPRECATED',
  BLOCKED: 'BLOCKED',
})

export const SkillRisk = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' })

export const SkillInvocation = Object.freeze({
  EXPLICIT: 'EXPLICIT',
  IMPLICIT: 'IMPLICIT',
  BOTH: 'BOTH',
})

export const SKILL_TRANSITIONS = Object.freeze({
  [SkillStatus.DRAFT]: new Set([SkillStatus.CANDIDATE, SkillStatus.BLOCKED]),
  [SkillStatus.CANDIDATE]: new Set([SkillStatus.TESTED, SkillStatus.BLOCKED, SkillStatus.DRAFT]),
  [SkillStatus.TESTED]: new Set([SkillStatus.APPROVED, SkillStatus.CANDIDATE, SkillStatus.BLOCKED]),
  [SkillStatus.APPROVED]: new Set([SkillStatus.DEPRECATED, SkillStatus.BLOCKED]),
  [SkillStatus.DEPRECATED]: new Set([SkillStatus.CANDIDATE]),
  [SkillStatus.BLOCKED]: new Set([SkillStatus.DRAFT]),
})

export function canTransitionSkill(from, to) {
  return Boolean(SKILL_TRANSITIONS[from]?.has(to))
}
