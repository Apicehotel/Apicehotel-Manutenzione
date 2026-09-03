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

export function experienceEvidenceKey(experience) {
  const normalized = normalizeExperience(experience)
  const source = normalized.source || {}
  const identity = source.id || normalized.metadata?.taskId || normalized.metadata?.runId || null
  if (!identity) throw new TypeError('Verified experience requires source.id, metadata.taskId or metadata.runId')
  return JSON.stringify([normalized.hotelId, source.kind || null, identity, normalized.metadata?.taskId || null])
}
