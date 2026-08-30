import { KnowledgeTrust, normalizeText } from './contracts.js'

const clone = (value) => structuredClone(value)
const TRUST_LABEL = Object.freeze({
  [KnowledgeTrust.APPROVED]: 'APPROVED',
  [KnowledgeTrust.VERIFIED]: 'VERIFIED',
  [KnowledgeTrust.AI_SUGGESTION]: 'SUGGESTED',
  [KnowledgeTrust.UNKNOWN]: 'UNKNOWN',
})

function similarity(query, text) {
  const tokens = normalizeText(query).split(/\s+/).filter((token) => token.length > 2)
  const haystack = normalizeText(text)
  if (!tokens.length) return 0
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0) / tokens.length
}

export class MaintenanceDecisionEngine {
  constructor({ knowledgeEngine, memoryEngine = null, gapEngine = null } = {}) {
    if (!knowledgeEngine?.search) throw new TypeError('MaintenanceDecisionEngine requires a knowledge engine')
    this.knowledgeEngine = knowledgeEngine
    this.memoryEngine = memoryEngine
    this.gapEngine = gapEngine
  }

  async assess({ hotelId, report, area = null, equipmentId = null, taskId = null, projectId = 'randai' } = {}) {
    if (!hotelId || !String(report || '').trim()) throw new TypeError('hotelId and report are required')
    const query = [report, area].filter(Boolean).join(' ')
    const lookup = this.knowledgeEngine.search({ hotelId, query })
    const suggestions = []
    const unknowns = []
    let gap = null

    if (lookup.found) {
      const procedure = lookup.procedure
      suggestions.push({
        id: `procedure:${procedure.id}`,
        kind: 'procedure',
        trust: TRUST_LABEL[procedure.trust] || procedure.trust,
        title: procedure.title,
        summary: procedure.summary,
        procedureId: procedure.id,
        score: Math.min(1, 0.6 + (lookup.score || 0) * 0.05),
        reasons: ['procedura operativa approvata o verificata', 'corrispondenza con il sintomo segnalato'],
        provenance: { kind: 'maintenance_procedure', id: procedure.id, version: procedure.version },
      })
    } else {
      unknowns.push({ kind: 'knowledge', message: lookup.message, trust: 'UNKNOWN' })
      if (this.gapEngine?.captureUnknown) {
        const captured = await this.gapEngine.captureUnknown(lookup, {
          hotelId,
          projectId,
          taskId,
          question: String(report).trim(),
          context: area ? `Area: ${area}` : null,
          entityType: equipmentId ? 'equipment' : 'maintenance_report',
          entityId: equipmentId || null,
        })
        gap = captured.gap || null
      }
    }

    if (this.memoryEngine?.recall) {
      const memories = await this.memoryEngine.recall(query, { hotelId, limit: 5 })
      for (const memory of memories) {
        const score = similarity(query, `${memory.summary || ''} ${memory.content || ''}`)
        if (score <= 0) continue
        suggestions.push({
          id: `memory:${memory.id}`,
          kind: 'experience',
          trust: String(memory.trust || 'suggested').toUpperCase(),
          title: memory.summary || 'Caso precedente simile',
          summary: memory.summary || memory.content,
          procedureId: null,
          score: Math.min(0.79, 0.35 + score * 0.4),
          reasons: ['esperienza precedente pertinente', `affinità ${(score * 100).toFixed(0)}% con la segnalazione`],
          provenance: { kind: 'memory', id: memory.id, source: clone(memory.source || null) },
        })
      }
    }

    suggestions.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))
    return {
      hotelId,
      report: String(report).trim(),
      area,
      equipmentId,
      suggestions,
      unknowns,
      gap,
      canStartGuidance: suggestions.some((item) => item.kind === 'procedure' && ['APPROVED', 'VERIFIED'].includes(item.trust)),
    }
  }
}
