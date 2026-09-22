import { supabase } from '../supabase.js'
import { findInternalProcedure } from './knowledge.js'
import { createRandAIContextEnvelope, getRandAIContext } from './context/envelope.js'

function mapProcedure(procedure) {
  if (!procedure) return null
  return {
    ...procedure,
    hotelId: procedure.hotelId || procedure.hotel_id,
    sourceType: procedure.sourceType || 'procedura_interna',
    sourceLabel: procedure.sourceLabel || procedure.source_label || 'Procedura interna approvata',
  }
}

export async function retrieveRandAIGuidance({ hotelId, query, contextQuery = '', operationalContext = null }) {
  if (!hotelId || !query?.trim()) return null

  if (!supabase) {
    const fallback = findInternalProcedure({ hotelId, query })
    return fallback
      ? {
          found: true,
          procedure: fallback,
          equipment: [],
          history: [],
          documents: [],
          memory: [],
          sensors: [],
          hvacDiagnostic: null,
          operationalContext: null,
          source: 'local-fallback',
          headline: `Segui: ${fallback.title}`,
          nextChecks: Array.isArray(fallback.steps) && fallback.steps[0] ? [`Procedura: ${fallback.steps[0]}`] : [],
          resolvedQuery: query.trim(),
        }
      : {
          found: false,
          reason: 'no_approved_knowledge',
          headline: 'Conoscenza insufficiente per questo problema.',
          nextChecks: [
            'Indica camera o zona e il sintomo (es. non raffresca / non scalda).',
            'Se possibile, specifica Wine o Jazz e il piano.',
            'Controlla se c’è già una procedura approvata o un caso in memoria per questa struttura.',
            'Annota temperature/interruttori visti sul campo prima di chiudere.',
          ],
          gapCaptured: false,
          gapId: null,
          resolvedQuery: query.trim(),
        }
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

  if (!data.found) {
    return {
      found: false,
      reason: data.reason || 'no_approved_knowledge',
      headline: data.headline || 'Conoscenza insufficiente per questo problema.',
      nextChecks: Array.isArray(data.nextChecks) ? data.nextChecks : [],
      gapCaptured: Boolean(data.gapCaptured),
      gapId: data.gapId || null,
      intent: data.intent || 'general',
      section: data.section || null,
      operationalContext: data.operationalContext || null,
      resolvedQuery: data.resolvedQuery || query.trim(),
    }
  }

  return {
    found: true,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    procedure: mapProcedure(data.procedure),
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
    headline: data.headline || null,
    nextChecks: Array.isArray(data.nextChecks) ? data.nextChecks : [],
    resolvedQuery: data.resolvedQuery || query.trim(),
  }
}
