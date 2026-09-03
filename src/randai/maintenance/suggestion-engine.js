import { KnowledgeTrust, normalizeText } from './contracts.js'

const TRUST_RANK = Object.freeze({
  [KnowledgeTrust.APPROVED]: 4,
  [KnowledgeTrust.VERIFIED]: 3,
  [KnowledgeTrust.AI_SUGGESTION]: 1,
  [KnowledgeTrust.UNKNOWN]: 0,
})

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0))
const clone = (value) => structuredClone(value)

function relevance(query, candidate) {
  const tokens = normalizeText(query).split(/\s+/).filter((token) => token.length > 2)
  if (!tokens.length) return 0
  const text = normalizeText([
    candidate.title,
    candidate.summary,
    candidate.symptom,
    candidate.area,
    candidate.category,
    ...(candidate.keywords || []),
  ].filter(Boolean).join(' '))
  return tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0) / tokens.length
}

function riskFor(candidate, actionable) {
  if (!actionable) return 'low'
  if (candidate.risk === 'high' || candidate.requiredRole === 'tecnico_esterno') return 'high'
  if (candidate.caution || candidate.requiredRole === 'manutentore') return 'medium'
  return 'low'
}

function makeProcedureSuggestion(query, procedure) {
  const trust = String(procedure.trust || KnowledgeTrust.UNKNOWN).toUpperCase()
  const actionable = [KnowledgeTrust.APPROVED, KnowledgeTrust.VERIFIED].includes(trust)
  const match = relevance(query, procedure)
  return {
    id: `procedure:${procedure.id}`,
    kind: 'procedure',
    title: procedure.title,
    summary: procedure.summary,
    procedureId: procedure.id,
    trust,
    relevance: Number(match.toFixed(4)),
    confidence: Number(clamp((TRUST_RANK[trust] || 0) / 4 * 0.65 + match * 0.35).toFixed(4)),
    risk: riskFor(procedure, actionable),
    actionable,
    nextAction: procedure.steps?.[0]?.title || procedure.steps?.[0] || 'Apri la procedura e verifica il primo passaggio.',
    reasons: [
      actionable ? 'fonte interna verificata' : 'fonte non ancora approvata',
      match > 0 ? `corrispondenza ${Math.round(match * 100)}% con la segnalazione` : 'corrispondenza debole',
    ],
    provenance: { kind: 'maintenance_procedure', id: procedure.id, version: procedure.version || 1 },
  }
}

function makeMemorySuggestion(query, memory) {
  const match = relevance(query, {
    title: memory.summary,
    summary: memory.content,
    symptom: memory.symptom,
    area: memory.area,
    category: memory.category,
  })
  if (match <= 0) return null
  const trust = String(memory.trust || KnowledgeTrust.UNKNOWN).toUpperCase()
  return {
    id: `memory:${memory.id}`,
    kind: 'experience',
    title: memory.summary || 'Caso precedente simile',
    summary: memory.content || memory.summary || '',
    procedureId: null,
    trust,
    relevance: Number(match.toFixed(4)),
    confidence: Number(clamp(0.25 + match * 0.45 + (trust === KnowledgeTrust.VERIFIED ? 0.3 : 0)).toFixed(4)),
    risk: 'low',
    actionable: false,
    nextAction: 'Confronta il caso precedente con i dati attuali; non applicare automaticamente la soluzione.',
    reasons: [`affinità ${Math.round(match * 100)}% con la segnalazione`, 'esperienza precedente, non procedura operativa'],
    provenance: { kind: 'memory', id: memory.id, source: clone(memory.source || null) },
  }
}

export function rankMaintenanceSuggestions({ query, procedures = [], memories = [], limit = 5 } = {}) {
  const cleanQuery = String(query || '').trim()
  if (!cleanQuery) return []
  const candidates = [
    ...procedures.map((procedure) => makeProcedureSuggestion(cleanQuery, procedure)),
    ...memories.map((memory) => makeMemorySuggestion(cleanQuery, memory)).filter(Boolean),
  ]
  const seen = new Set()
  return candidates
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => (TRUST_RANK[b.trust] || 0) - (TRUST_RANK[a.trust] || 0) || b.confidence - a.confidence || b.relevance - a.relevance || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(10, Number(limit) || 5)))
}

export function selectPrimaryMaintenanceSuggestion(suggestions = []) {
  return suggestions.find((item) => item.kind === 'procedure' && item.actionable) || suggestions[0] || null
}
