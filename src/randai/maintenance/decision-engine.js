import { KnowledgeTrust } from './contracts.js'
import { rankMaintenanceSuggestions, selectPrimaryMaintenanceSuggestion } from './suggestion-engine.js'

const clone = (value) => structuredClone(value)
const TRUST_LABEL = Object.freeze({
  [KnowledgeTrust.APPROVED]: 'APPROVED',
  [KnowledgeTrust.VERIFIED]: 'VERIFIED',
  [KnowledgeTrust.AI_SUGGESTION]: 'SUGGESTED',
  [KnowledgeTrust.UNKNOWN]: 'UNKNOWN',
})

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
    const procedures = this.knowledgeEngine.searchAll
      ? this.knowledgeEngine.searchAll({ hotelId, query }).map(({ item }) => item)
      : (lookup.found ? [lookup.procedure] : [])
    const memories = this.memoryEngine?.recall ? await this.memoryEngine.recall(query, { hotelId, limit: 5 }) : []
    const suggestions = rankMaintenanceSuggestions({ query, procedures, memories, limit: 5 })
    const unknowns = []
    let gap = null

    if (!lookup.found) {
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

    const primary = selectPrimaryMaintenanceSuggestion(suggestions)
    return {
      hotelId,
      report: String(report).trim(),
      area,
      equipmentId,
      suggestions,
      primarySuggestion: primary,
      unknowns,
      gap,
      canStartGuidance: Boolean(primary?.kind === 'procedure' && primary.actionable),
    }
  }
}
