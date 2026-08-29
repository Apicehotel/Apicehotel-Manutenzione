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

function scoreHistory(item, query, procedure) {
  const words = normalize(query).split(/\s+/).filter((word) => word.length > 3)
  const haystack = normalize([
    item.location, item.camera, item.category, item.categoria, item.description, item.note,
    item.completion_note, item.pezzo_nome, item.pezzo_sostituito, item.sezione,
  ].join(' '))
  let score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0)
  if (procedure?.category && haystack.includes(normalize(procedure.category))) score += 3
  if (procedure?.area && haystack.includes(normalize(procedure.area))) score += 2
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

function mapHistory(items) {
  return items.slice(0, 3).map((entry) => {
    const item = entry.item
    return {
      id: item.id,
      kind: item.__kind,
      location: item.location || item.camera || item.sezione || '',
      category: item.category || item.categoria || '',
      text: item.completion_note || item.note || item.description || '',
      status: item.status || item.stato || '',
      date: item.completed_at || item.completato_il || item.updated_at || item.creato_il || item.created_at || null,
    }
  })
}

export async function retrieveRandAIGuidance({ hotelId, query }) {
  if (!hotelId || !query?.trim()) return null

  if (!supabase) {
    const fallback = findInternalProcedure({ hotelId, query })
    return fallback ? { procedure: fallback, equipment: [], history: [], source: 'local-fallback' } : null
  }

  const [proceduresResult, equipmentResult, issuesResult, interventionsResult] = await Promise.all([
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
    supabase
      .from('maintenance_issues')
      .select('id,location,category,description,status,completion_note,completed_at,updated_at')
      .eq('hotel_id', hotelId)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('interventi')
      .select('id,camera,categoria,note,stato,sezione,pezzo_nome,pezzo_sostituito,completato_il,updated_at')
      .eq('hotel_id', hotelId)
      .order('updated_at', { ascending: false })
      .limit(20),
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

  const historyPool = [
    ...((issuesResult.error ? [] : issuesResult.data) || []).map((item) => ({ ...item, __kind: 'segnalazione' })),
    ...((interventionsResult.error ? [] : interventionsResult.data) || []).map((item) => ({ ...item, __kind: 'intervento' })),
  ]
  const history = mapHistory(historyPool
    .map((item) => ({ item, score: scoreHistory(item, query, procedure) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score))

  return { procedure, equipment, history, source: 'supabase' }
}
