import { supabase } from '../supabase.js'
import { findInternalProcedure } from './knowledge.js'

const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

function scoreProcedure(item, query) {
  const text = normalize(query)
  let score = 0
  for (const keyword of item.keywords || []) {
    const token = normalize(keyword)
    if (token && text.includes(token)) score += token.includes(' ') ? 3 : 2
  }
  for (const field of [item.category, item.area, item.symptom]) {
    const token = normalize(field)
    if (token && text.includes(token)) score += 3
  }
  return score
}

function mapProcedure(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    title: row.title,
    category: row.category,
    area: row.area,
    symptom: row.symptom,
    summary: row.summary,
    keywords: row.keywords || [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    caution: row.caution,
    sourceType: 'procedura_interna',
    sourceLabel: row.source_label || 'Procedura interna approvata',
    version: row.version,
  }
}

export async function retrieveRandAIGuidance({ hotelId, query }) {
  if (!hotelId || !query?.trim()) return null

  if (!supabase) {
    const fallback = findInternalProcedure({ hotelId, query })
    return fallback ? { procedure: fallback, equipment: [], source: 'local-fallback' } : null
  }

  const [proceduresResult, equipmentResult] = await Promise.all([
    supabase
      .from('randai_procedures')
      .select('id,hotel_id,title,category,area,symptom,summary,keywords,steps,caution,source_label,version')
      .eq('hotel_id', hotelId)
      .eq('status', 'approved'),
    supabase
      .from('randai_equipment')
      .select('id,name,category,location,description,randai_equipment_serves(served_area,note)')
      .eq('hotel_id', hotelId)
      .eq('active', true),
  ])

  if (proceduresResult.error) throw proceduresResult.error
  if (equipmentResult.error) throw equipmentResult.error

  const ranked = (proceduresResult.data || [])
    .map((row) => ({ procedure: mapProcedure(row), score: scoreProcedure(row, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const procedure = ranked[0]?.procedure
  if (!procedure) return null

  const queryText = normalize(query)
  const equipment = (equipmentResult.data || []).filter((item) => {
    const haystack = normalize([item.name, item.category, item.location, item.description].join(' '))
    const procedureContext = normalize([procedure.category, procedure.area, procedure.summary].join(' '))
    return (item.category && normalize(item.category) === normalize(procedure.category))
      || queryText.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word))
      || (procedure.area && haystack.includes(normalize(procedure.area)))
      || procedureContext.includes(normalize(item.category))
  })

  return { procedure, equipment, source: 'supabase' }
}
