import { SkillStatus } from './contracts.js'

const normalize = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ')

function scoreSkill(skill, text) {
  const routing = skill?.metadata?.routing || {}
  const keywords = routing.keywords || []
  let score = 0
  const reasons = []
  for (const keyword of keywords) {
    const needle = normalize(keyword)
    if (needle && text.includes(needle)) {
      const weight = Math.max(2, needle.split(/\s+/).length * 4)
      score += weight
      reasons.push(keyword)
    }
  }
  if (score > 0) score += Number(routing.priority || 0) / 10
  return { score, reasons }
}

function unique(values) { return [...new Set(values)] }

export class RandSkillRouter {
  constructor({ skillRegistry, minConfidence = 0.35, maxSkills = 3 } = {}) {
    if (!skillRegistry?.list || !skillRegistry?.inspect) throw new TypeError('RandSkillRouter requires skillRegistry')
    this.skillRegistry = skillRegistry
    this.minConfidence = minConfidence
    this.maxSkills = maxSkills
  }

  route({ objective = '', explicitSkillIds = [] } = {}) {
    const explicit = unique((explicitSkillIds || []).map(String))
      .map((id) => this.skillRegistry.inspect(id))
      .filter((skill) => skill?.status === SkillStatus.APPROVED)

    if (explicit.length) {
      return this.#decision(explicit.slice(0, this.maxSkills), 1, 'EXPLICIT', explicit.map((skill) => ({ id: skill.id, score: 1, reasons: ['explicit'] })))
    }

    const text = normalize(objective)
    const ranked = this.skillRegistry.list()
      .filter((skill) => skill.status === SkillStatus.APPROVED)
      .map((summary) => this.skillRegistry.inspect(summary.id, summary.version))
      .map((skill) => ({ skill, ...scoreSkill(skill, text) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))

    if (!ranked.length) return this.#decision([], 0, 'FALLBACK', [])

    const top = ranked[0].score
    const threshold = Math.max(2, top * 0.45)
    const selected = ranked.filter((item) => item.score >= threshold).slice(0, this.maxSkills)
    const confidence = Math.min(1, top / 14)
    if (confidence < this.minConfidence) return this.#decision([], confidence, 'FALLBACK', ranked.slice(0, 3).map(this.#explain))

    return this.#decision(selected.map((item) => item.skill), confidence, selected.length > 1 ? 'COMPOSED' : 'MATCHED', selected.map(this.#explain))
  }

  #explain(item) { return { id: item.skill.id, score: Number(item.score.toFixed(2)), reasons: [...item.reasons] } }

  #decision(skills, confidence, mode, matches) {
    return Object.freeze({
      mode,
      confidence: Number(confidence.toFixed(2)),
      skillIds: Object.freeze(skills.map((skill) => skill.id)),
      requiredPermissions: Object.freeze(unique(skills.flatMap((skill) => skill.permissions || []))),
      requiredToolPatterns: Object.freeze(unique(skills.flatMap((skill) => skill.requiredTools || []))),
      matches: Object.freeze(matches.map((match) => Object.freeze({ ...match, reasons: Object.freeze([...(match.reasons || [])]) }))),
      fallbackRequired: mode === 'FALLBACK',
    })
  }
}

export function matchesToolPattern(toolId, pattern) {
  const id = String(toolId)
  const value = String(pattern)
  if (!value.includes('*')) return id === value
  const escaped = value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(id)
}
