import { SkillStatus } from '../skills/contracts.js'
import { LearningCandidateStatus, experienceFingerprint, normalizeExperience } from './contracts.js'
import { LearningStore } from './store.js'

const clone = (value) => structuredClone(value)
const makeId = () => `LEARN-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`
const nowIso = () => new Date().toISOString()

export class LearningEngine {
  constructor({ store = new LearningStore(), minEvidence = 2 } = {}) {
    this.store = store
    this.minEvidence = Math.max(2, Number(minEvidence || 2))
  }

  async observe(experience) {
    const normalized = normalizeExperience(experience)
    const fingerprint = experienceFingerprint(experience)
    let candidate = await this.store.findByFingerprint(fingerprint)
    if (!candidate) {
      candidate = {
        id: makeId(), fingerprint, problemClass: normalized.problemClass, strategy: normalized.strategy,
        tools: normalized.tools, successCriteria: normalized.successCriteria, status: LearningCandidateStatus.OBSERVED,
        evidence: [], skillRef: null, evaluationId: null, createdAt: nowIso(), updatedAt: nowIso(),
      }
    }
    const evidenceKey = JSON.stringify([normalized.source?.kind || null, normalized.source?.id || null, normalized.metadata?.taskId || null])
    if (!candidate.evidence.some((item) => item.key === evidenceKey)) {
      candidate.evidence.push({ key: evidenceKey, source: clone(normalized.source), metadata: clone(normalized.metadata), observedAt: nowIso() })
    }
    if (candidate.evidence.length >= this.minEvidence && candidate.status === LearningCandidateStatus.OBSERVED) candidate.status = LearningCandidateStatus.CANDIDATE
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    return clone(candidate)
  }

  async proposeSkill(candidateId, { skillRegistry, id, version = '0.1.0', name, description, risk = 'LOW' } = {}) {
    const candidate = await this.store.get(candidateId)
    if (!candidate) throw new Error(`Unknown learning candidate: ${candidateId}`)
    if (candidate.status !== LearningCandidateStatus.CANDIDATE) throw new Error('Candidate needs sufficient verified evidence before skill proposal')
    if (!skillRegistry || !id || !name || !description) throw new TypeError('skillRegistry, id, name and description are required')
    skillRegistry.register({ id, version, name, description, risk, status: SkillStatus.DRAFT, requiredTools: candidate.tools, instructions: [candidate.strategy], successCriteria: candidate.successCriteria, metadata: { learningCandidateId: candidate.id, evidenceCount: candidate.evidence.length } })
    skillRegistry.transition(id, version, SkillStatus.CANDIDATE)
    candidate.skillRef = { id, version }
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    return { candidate: clone(candidate), skill: skillRegistry.inspect(id, version) }
  }

  async evaluate(candidateId, { evaluationEngine, scenario, skillRegistry } = {}) {
    const candidate = await this.store.get(candidateId)
    if (!candidate?.skillRef) throw new Error('Candidate skill must be proposed before evaluation')
    if (!evaluationEngine || !scenario || !skillRegistry) throw new TypeError('evaluationEngine, scenario and skillRegistry are required')
    candidate.status = LearningCandidateStatus.EVALUATING
    candidate.updatedAt = nowIso()
    await this.store.save(candidate)
    const evaluation = await evaluationEngine.runScenario(scenario, { learningCandidate: clone(candidate), skill: skillRegistry.inspect(candidate.skillRef.id, candidate.skillRef.version) })
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
