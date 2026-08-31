export const LearningCandidateStatus = Object.freeze({
  OBSERVED: 'OBSERVED', CANDIDATE: 'CANDIDATE', EVALUATING: 'EVALUATING', TESTED: 'TESTED', REJECTED: 'REJECTED',
})

export function normalizeExperience(experience) {
  if (!experience?.problemClass || !experience?.strategy) throw new TypeError('Experience requires problemClass and strategy')
  if (experience.verified !== true) throw new Error('Only verified experiences can be learned')
  const hotelId = String(experience.hotelId || experience.metadata?.hotelId || '').trim() || null
  return {
    hotelId,
    problemClass: String(experience.problemClass).trim().toLowerCase(),
    strategy: String(experience.strategy).trim(),
    tools: [...new Set((experience.tools || []).map(String))].sort(),
    successCriteria: [...new Set((experience.successCriteria || []).map(String))],
    source: experience.source || null,
    metadata: structuredClone(experience.metadata || {}),
  }
}

export function experienceFingerprint(experience) {
  const normalized = normalizeExperience(experience)
  return JSON.stringify([normalized.hotelId, normalized.problemClass, normalized.strategy.toLowerCase(), normalized.tools])
}
