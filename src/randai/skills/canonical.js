import { SkillInvocation, SkillRisk, SkillStatus } from './contracts.js'
import { SkillRegistry } from './registry.js'

const DEFINITIONS = Object.freeze([
  { id: 'maintenance', name: 'Maintenance', description: 'Diagnosi, segnalazioni e interventi tecnici hotel.', tags: ['maintenance','operations'], risk: SkillRisk.HIGH },
  { id: 'housekeeping', name: 'Housekeeping', description: 'Piani, camere, attività e segnalazioni housekeeping.', tags: ['housekeeping','operations'], risk: SkillRisk.MEDIUM },
  { id: 'planning', name: 'Planning', description: 'Planning sale, lavori, calendario, conflitti e dipendenze.', tags: ['planning','operations'], risk: SkillRisk.MEDIUM },
  { id: 'warehouse', name: 'Warehouse', description: 'Materiali, categorie, disponibilità e movimenti magazzino.', tags: ['warehouse','inventory'], risk: SkillRisk.HIGH },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Routing e risposte sui canali WhatsApp autorizzati.', tags: ['whatsapp','messaging'], risk: SkillRisk.HIGH },
  { id: 'procedures', name: 'Procedures', description: 'Consultazione, bozza, revisione e workflow RandGuide.', tags: ['procedures','randguide'], risk: SkillRisk.HIGH },
  { id: 'repo-radar', name: 'Repo Radar', description: 'Valutazione repository e fonti esterne contro l ecosistema Rand.', tags: ['repo-radar','randcore'], risk: SkillRisk.MEDIUM },
])

export const RAND_SKILL_CATALOG_VERSION = '1.0.0'

export function canonicalRandSkillDefinitions() {
  return DEFINITIONS.map((skill) => ({
    ...skill,
    version: RAND_SKILL_CATALOG_VERSION,
    status: SkillStatus.APPROVED,
    invocation: SkillInvocation.BOTH,
    permissions: [],
    requiredTools: [],
    instructions: [],
    successCriteria: [],
    metadata: { source: `rand-skills/${skill.id}/SKILL.md`, governedBy: 'RandCore' },
  }))
}

export function registerCanonicalRandSkills(registry = new SkillRegistry()) {
  for (const definition of canonicalRandSkillDefinitions()) {
    if (!registry.get(definition.id, definition.version)) registry.register(definition)
  }
  return registry
}
