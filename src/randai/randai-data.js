import { supabase } from '../supabase.js'
import { findInternalProcedure } from './knowledge.js'

export async function retrieveRandAIGuidance({ hotelId, query }) {
  if (!hotelId || !query?.trim()) return null

  if (!supabase) {
    const fallback = findInternalProcedure({ hotelId, query })
    return fallback ? { procedure: fallback, equipment: [], history: [], documents: [], memory: [], sensors: [], source: 'local-fallback' } : null
  }

  const { data, error } = await supabase.functions.invoke('randai-assistant', {
    body: { hotel_id: hotelId, query: query.trim() },
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
    source: data.source || 'approved_internal_knowledge',
  }
}
