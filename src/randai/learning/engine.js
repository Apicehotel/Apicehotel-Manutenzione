import { SkillStatus } from '../skills/contracts.js'
import { LearningCandidateStatus, experienceEvidenceKey, experienceFingerprint, normalizeExperience } from './contracts.js'
import { LearningStore } from './store.js'

const clone = (value) => structuredClone(value)
const makeId = () => `LEARN-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`
const nowIso = () => new Date().toISOString()

function validMinEvidence(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 2) throw new TypeError('minEvidence must be an integer >= 2')
  return numeric
}

export class LearningEngine {
  constructor({ store = new LearningStore(), minEvidence = 2 } = {}) {
    this.store = store
    this.minEvidence = validMinEvidence(minEvidence)
  }

  async observe(experience) {
    const normalized = normalizeExperience(experience)
    const fingerprint = experienceFingerprint(experience)
    let candidate = await this.store.findByFingerprint(fingerprint, normalized.hotelId)
    if (!candidate) {
      candidate = {
        id: makeId(), hotelId: normalized.hotelId, fingerprint, problemClass: normalized.problemClass, strategy: normalized.strategy,
        tools: normalized.tools, successCriteria: normalized.successCriteria, status: LearningCandidateStatus.OBSERVED,
        evidence: [], skillRef: null, evaluationId: null, evaluationError: null, createdAt: nowIso(), updatedAt: nowIso(),
      }
    }
    const evidenceKey = experienceEvidenceKey(experience)
    if (!candidate.evidence.some((item) => item.key === evidenceKey)) {
      candidate.evidence.push({ key: evidenceKey, source: clone(normalized.source), metadata: clone(normalized.metadata), observedAt: nowIso() })
    }
    if (candidate.evidence.length >= this.minEvidence && candidate.status === LearningCandidateStatus.OBSERVED) candidate.status = LearningCandidateStatus.CANDIDATE
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    return clone(candidate)
  }

  async proposeSkill(candidateId, { skillRegistry, id, version = '0.1.0', name, description, risk = 'LOW', hotelId = null } = {}) {
    const candidate = await this.store.get(candidateId, hotelId)
    if (!candidate) throw new Error(`Unknown or out-of-scope learning candidate: ${candidateId}`)
    if (candidate.status !== LearningCandidateStatus.CANDIDATE) throw new Error('Candidate needs sufficient verified evidence before skill proposal')
    if (!skillRegistry || !id || !name || !description) throw new TypeError('skillRegistry, id, name and description are required')
    skillRegistry.register({ id, version, name, description, risk, status: SkillStatus.DRAFT, requiredTools: candidate.tools, instructions: [candidate.strategy], successCriteria: candidate.successCriteria, metadata: { learningCandidateId: candidate.id, hotelId: candidate.hotelId || null, evidenceCount: candidate.evidence.length } })
    skillRegistry.transition(id, version, SkillStatus.CANDIDATE)
    candidate.skillRef = { id, version }
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    return { candidate: clone(candidate), skill: skillRegistry.inspect(id, version) }
  }

  async approve(candidateId, { skillRegistry, approvedBy, hotelId = null } = {}) {
    if (!approvedBy || typeof approvedBy !== 'string' || !approvedBy.trim()) throw new TypeError('approvedBy is required')
    const candidate = await this.store.get(candidateId, hotelId)
    if (!candidate?.skillRef) throw new Error('Candidate skill must be proposed and in scope before approval')
    if (candidate.status !== LearningCandidateStatus.TESTED) throw new Error('Only tested learning candidates can be approved')
    if (!skillRegistry) throw new TypeError('skillRegistry is required')
    const skill = skillRegistry.inspect(candidate.skillRef.id, candidate.skillRef.version)
    if (skill?.status !== SkillStatus.TESTED) throw new Error('Only tested skills can be approved')
    const approved = skillRegistry.transition(candidate.skillRef.id, candidate.skillRef.version, SkillStatus.APPROVED)
    candidate.approvedBy = approvedBy.trim()
    candidate.approvedAt = nowIso()
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    return { candidate: clone(candidate), skill: approved }
  }

  async evaluate(candidateId, { evaluationEngine, scenario, skillRegistry, hotelId = null } = {}) {
    const candidate = await this.store.get(candidateId, hotelId)
    if (!candidate?.skillRef) throw new Error('Candidate skill must be proposed and in scope before evaluation')
    if (!evaluationEngine || !scenario || !skillRegistry) throw new TypeError('evaluationEngine, scenario and skillRegistry are required')
    candidate.status = LearningCandidateStatus.EVALUATING
    candidate.evaluationError = null
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    let evaluation
    try {
      evaluation = await evaluationEngine.runScenario(scenario, { hotelId: candidate.hotelId || null, learningCandidate: clone(candidate), skill: skillRegistry.inspect(candidate.skillRef.id, candidate.skillRef.version) })
    } catch (error) {
      const skill = skillRegistry.inspect(candidate.skillRef.id, candidate.skillRef.version)
      if (skill?.status === SkillStatus.CANDIDATE) skillRegistry.transition(candidate.skillRef.id, candidate.skillRef.version, SkillStatus.BLOCKED)
      candidate.status = LearningCandidateStatus.REJECTED
      candidate.evaluationError = { message: error?.message || String(error), at: nowIso() }
      candidate.updatedAt = nowIso()
      await this.store.save(candidate)
      throw error
    }
    candidate.evaluationId = evaluation.id
    if (evaluation.passed) {
      skillRegistry.transition(candidate.skillRef.id, candidate.skillRef.version, SkillStatus.TESTED)
      candidate.status = LearningCandidateStatus.TESTED
    } else {
      skillRegistry.transition(candidate.skillRef.id, candidate.skillRef.version, SkillStatus.BLOCKED)
      candidate.status = LearningCandidateStatus.REJECTED
    }
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    return { candidate: clone(candidate), evaluation, skill: skillRegistry.inspect(candidate.skillRef.id, candidate.skillRef.version) }
  }
}
