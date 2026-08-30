import { KnowledgeTrust, normalizeText } from '../maintenance/contracts.js'
import { GapPriority, GapScope } from '../gaps/contracts.js'
import { GuidanceTrust, SuggestionKind } from './contracts.js'

const clone = (value) => structuredClone(value)
const tokenScore = (text, query) => {
  const haystack = normalizeText(text)
  return normalizeText(query).split(/\s+/).filter((x) => x.length > 2).reduce((n, token) => n + (haystack.includes(token) ? 1 : 0), 0)
}

export class MaintenanceDecisionEngine {
  constructor({ knowledge, gaps = null, memory = null } = {}) {
    if (!knowledge) throw new TypeError('MaintenanceDecisionEngine requires knowledge engine')
    this.knowledge = knowledge
    this.gaps = gaps
    this.memory = memory
  }

  async suggest({ hotelId, report, area = null, equipmentId = null, maxSuggestions = 5 } = {}) {
    if (!hotelId || !String(report || '').trim()) throw new TypeError('hotelId and report are required')
    const lookup = this.knowledge.search({ hotelId, query: [area, report].filter(Boolean).join(' ') })
    const suggestions = []
    let gap = null

    if (lookup.found) {
      const procedure = lookup.procedure
      suggestions.push({
        id: `procedure:${procedure.id}`,
        kind: SuggestionKind.PROCEDURE,
        trust: procedure.trust,
        title: procedure.title,
        reason: `Procedura ${procedure.trust.toLowerCase()} pertinente alla segnalazione`,
        score: 100 + Number(lookup.score || 0),
        procedure: clone(procedure),
        source: { kind: 'maintenance_procedure', id: procedure.id, version: procedure.version || 1 },
      })
    } else if (this.gaps) {
      const captured = await this.gaps.captureUnknown(lookup, {
        scope: GapScope.MAINTENANCE, hotelId, question: report, context: area,
        priority: GapPriority.NORMAL, entityType: equipmentId ? 'equipment' : 'maintenance_report', entityId: equipmentId,
      })
      gap = captured.gap || null
      suggestions.push({ id: gap ? `gap:${gap.id}` : 'unknown', kind: SuggestionKind.UNKNOWN, trust: GuidanceTrust.UNKNOWN, title: 'Informazione verificata non disponibile', reason: lookup.message, score: -1, gapId: gap?.id || null })
    }

    const equipment = area ? this.knowledge.findEquipmentForArea({ hotelId, area }) : []
    for (const item of equipment) {
      if (![KnowledgeTrust.APPROVED, KnowledgeTrust.VERIFIED].includes(item.trust)) continue
      suggestions.push({ id: `equipment:${item.id}`, kind: SuggestionKind.KNOWLEDGE, trust: item.trust, title: item.name, reason: `Impianto verificato collegato all'area ${area}`, score: 60, equipment: clone(item), source: { kind: 'maintenance_equipment', id: item.id } })
    }

    if (this.memory?.retrieve) {
      const memories = await this.memory.retrieve({ hotelId, query: report, limit: 5 })
      for (const memory of memories || []) {
        const trust = String(memory.trust || '').toUpperCase()
        if (!['APPROVED', 'VERIFIED'].includes(trust)) continue
        const score = 30 + tokenScore(`${memory.summary || ''} ${memory.content || ''}`, report)
        suggestions.push({ id: `memory:${memory.id}`, kind: SuggestionKind.MEMORY, trust, title: memory.summary || 'Caso precedente verificato', reason: 'Esperienza precedente verificata e pertinente', score, memory: clone(memory), source: memory.source || { kind: 'memory', id: memory.id } })
      }
    }

    suggestions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    return { hotelId, report, area, knowledgeFound: lookup.found, gap, suggestions: suggestions.slice(0, maxSuggestions) }
  }
}
