import { SkillInvocation, SkillRisk, SkillStatus, canTransitionSkill } from './contracts.js'

const VALID_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const VALID_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const VALID_RISKS = new Set(Object.values(SkillRisk))
const VALID_STATUSES = new Set(Object.values(SkillStatus))
const VALID_INVOCATIONS = new Set(Object.values(SkillInvocation))

function validateDefinition(definition) {
  if (!definition?.id || !definition?.name || !definition?.description || !definition?.version) {
    throw new TypeError('Skill requires id, name, description and version')
  }
  if (!VALID_ID.test(definition.id)) throw new TypeError(`Invalid skill id: ${definition.id}`)
  if (!VALID_VERSION.test(definition.version)) throw new TypeError(`Invalid skill version: ${definition.version}`)
  if (definition.risk && !VALID_RISKS.has(definition.risk)) throw new TypeError(`Invalid skill risk: ${definition.risk}`)
  if (definition.status && !VALID_STATUSES.has(definition.status)) throw new TypeError(`Invalid skill status: ${definition.status}`)
  if (definition.invocation && !VALID_INVOCATIONS.has(definition.invocation)) throw new TypeError(`Invalid skill invocation: ${definition.invocation}`)
}

function summary(skill) {
  return Object.freeze({
    id: skill.id,
    name: skill.name,
    version: skill.version,
    description: skill.description,
    status: skill.status,
    risk: skill.risk,
    invocation: skill.invocation,
    tags: skill.tags,
    requiredTools: skill.requiredTools,
    permissions: skill.permissions,
  })
}

function versionParts(version) {
  return version.split(/[.-]/).slice(0, 3).map(value => Number.parseInt(value, 10))
}

function newest(a, b) {
  const av = versionParts(a.version)
  const bv = versionParts(b.version)
  for (let i = 0; i < 3; i += 1) {
    if (av[i] !== bv[i]) return bv[i] - av[i]
  }
  return b.version.localeCompare(a.version)
}

export class SkillRegistry {
  #skills = new Map()

  register(definition) {
    validateDefinition(definition)
    const key = `${definition.id}@${definition.version}`
    if (this.#skills.has(key)) throw new Error(`Skill already registered: ${key}`)
    const normalized = Object.freeze({
      status: SkillStatus.DRAFT,
      risk: SkillRisk.LOW,
      invocation: SkillInvocation.BOTH,
      tags: [],
      requiredTools: [],
      permissions: [],
      instructions: [],
      successCriteria: [],
      run: null,
      metadata: {},
      ...definition,
      tags: Object.freeze([...(definition.tags ?? [])]),
      requiredTools: Object.freeze([...(definition.requiredTools ?? [])]),
      permissions: Object.freeze([...(definition.permissions ?? [])]),
      instructions: Object.freeze([...(definition.instructions ?? [])]),
      successCriteria: Object.freeze([...(definition.successCriteria ?? [])]),
      metadata: Object.freeze({ ...(definition.metadata ?? {}) }),
    })
    this.#skills.set(key, normalized)
    return summary(normalized)
  }

  get(id, version) {
    if (version) return this.#skills.get(`${id}@${version}`) ?? null
    return [...this.#skills.values()].filter(skill => skill.id === id).sort(newest)[0] ?? null
  }

  inspect(id, version) { return this.get(id, version) }
  list() { return [...this.#skills.values()].map(summary) }

  discover({ text, status = SkillStatus.APPROVED, tag, toolId, includeExplicitOnly = false } = {}) {
    const needle = text?.trim().toLowerCase()
    return this.list().filter(skill => {
      if (status && skill.status !== status) return false
      if (tag && !skill.tags.includes(tag)) return false
      if (toolId && !skill.requiredTools.includes(toolId)) return false
      if (includeExplicitOnly && skill.invocation === SkillInvocation.IMPLICIT) return false
      if (needle && !`${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase().includes(needle)) return false
      return true
    })
  }

  transition(id, version, nextStatus) {
    const current = this.get(id, version)
    if (!current) throw new Error(`Unknown skill: ${id}@${version}`)
    if (!VALID_STATUSES.has(nextStatus)) throw new TypeError(`Invalid skill status: ${nextStatus}`)
    if (!canTransitionSkill(current.status, nextStatus)) throw new Error(`Invalid skill transition: ${current.status} -> ${nextStatus}`)
    const updated = Object.freeze({ ...current, status: nextStatus })
    this.#skills.set(`${id}@${version}`, updated)
    return summary(updated)
  }
}
