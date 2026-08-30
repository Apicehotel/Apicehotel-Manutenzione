import { supabase } from '../supabase.js'
import { findInternalProcedure } from './knowledge.js'
import { buildOperationalContext, contextQueryHint } from './context/operational-context.js'

export async function retrieveRandAIGuidance({ hotelId, query, contextQuery = '', operationalContext = null }) {
  if (!hotelId || !query?.trim()) return null

  const context = operationalContext ? buildOperationalContext(operationalContext) : null
  const scopedContext = context?.hotelId === hotelId ? context : null
  const effectiveContextQuery = String(contextQuery || '').trim() || contextQueryHint(scopedContext)

  if (!supabase) {
    const fallback = findInternalProcedure({ hotelId, query })
    return fallback ? { procedure: fallback, equipment: [], history: [], documents: [], memory: [], sensors: [], hvacDiagnostic: null, source: 'local-fallback', resolvedQuery: query.trim(), operationalContext: scopedContext } : null
  }

  const { data, error } = await supabase.functions.invoke('randai-assistant', {
    body: {
      hotel_id: hotelId,
      query: query.trim(),
      context_query: effectiveContextQuery,
      operational_context: scopedContext ? {
        version: scopedContext.version,
        hotel_id: scopedContext.hotelId,
        view: scopedContext.view,
        source: scopedContext.source,
        resource: scopedContext.resource ? {
          type: scopedContext.resource.type,
          id: scopedContext.resource.id,
        } : null,
      } : null,
    },
  })

  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'randai_unavailable')
  if (!data?.found) return null

  return {
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
    source: data.source || 'approved_internal_knowledge',
    intent: data.intent || 'general',
    section: data.section || null,
    resolvedQuery: data.resolvedQuery || query.trim(),
    operationalContext: data.operationalContext || scopedContext,
  }
}
