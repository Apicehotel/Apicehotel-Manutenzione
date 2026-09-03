import { supabase } from '../supabase.js'
import { findInternalProcedure } from './knowledge.js'
import { createRandAIContextEnvelope, getRandAIContext } from './context/envelope.js'

export async function retrieveRandAIGuidance({ hotelId, query, contextQuery = '', operationalContext = null }) {
  if (!hotelId || !query?.trim()) return null

  if (!supabase) {
    const fallback = findInternalProcedure({ hotelId, query })
    return fallback ? { procedure: fallback, equipment: [], history: [], documents: [], memory: [], sensors: [], hvacDiagnostic: null, operationalContext: null, source: 'local-fallback', resolvedQuery: query.trim() } : null
  }

  const activeContext = operationalContext || getRandAIContext() || createRandAIContextEnvelope({ hotelId })
  const context = activeContext?.hotelId === hotelId ? activeContext : createRandAIContextEnvelope({ hotelId })
  const { data, error } = await supabase.functions.invoke('randai-assistant', {
    body: {
      hotel_id: hotelId,
      query: query.trim(),
      context_query: String(contextQuery || '').trim(),
      context,
    },
  })

  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'randai_unavailable')
  if (!data?.found) return null

  return {
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    procedure: data.procedure ? {
      ...data.procedure,
      hotelId: data.procedure?.hotelId || data.procedure?.hotel_id,
      sourceType: data.procedure?.sourceType || 'procedura_interna',
      sourceLabel: data.procedure?.sourceLabel || data.procedure?.source_label || 'Procedura interna approvata',
    } : null,
    equipment: Array.isArray(data.equipment) ? data.equipment : [],
    history: Array.isArray(data.history) ? data.history : [],
    documents: Array.isArray(data.documents) ? data.documents : [],
    memory: Array.isArray(data.memory) ? data.memory : [],
    sensors: Array.isArray(data.sensors) ? data.sensors : [],
    hvacDiagnostic: data.hvacDiagnostic || null,
    operationalContext: data.operationalContext || null,
    source: data.source || 'approved_internal_knowledge',
    intent: data.intent || 'general',
    section: data.section || null,
    resolvedQuery: data.resolvedQuery || query.trim(),
  }
}
