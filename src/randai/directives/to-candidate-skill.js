import { DirectiveStatus } from './contracts.js'
import { SkillInvocation, SkillRisk, SkillStatus } from '../skills/contracts.js'

function slugify(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function directiveToCandidateSkill(directive, overrides = {}) {
  if (!directive || directive.status !== DirectiveStatus.APPROVED) {
    throw new Error('Only approved directives can become candidate skills')
  }
  const id = overrides.id || `directive-${slugify(directive.title || directive.id)}`
  return {
    id,
    name: overrides.name || directive.title,
    version: overrides.version || '0.1.0',
    description: overrides.description || `Skill candidate generated from approved directive ${directive.id}.`,
    status: SkillStatus.CANDIDATE,
    risk: overrides.risk || SkillRisk.LOW,
    invocation: overrides.invocation || SkillInvocation.EXPLICIT,
    tags: [...(overrides.tags ?? ['directive'])],
    requiredTools: [...(overrides.requiredTools ?? [])],
    permissions: [...(overrides.permissions ?? [])],
    instructions: [...directive.rules, ...directive.forbidden.map(item => `DO NOT: ${item}`)],
    successCriteria: [...directive.successCriteria],
    metadata: { sourceDirectiveId: directive.id, sourceDirectiveVersion: directive.version, ...(overrides.metadata ?? {}) },
    run: overrides.run ?? null,
  }
}
