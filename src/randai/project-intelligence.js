const clone = (value) => value == null ? value : structuredClone(value)

const normalize = (value) => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()

const tokens = (value) => new Set(normalize(value).match(/[\p{L}\p{N}\d_-]+/gu) || [])
const overlap = (query, value) => {
  const left = tokens(query)
  const right = tokens(value)
  if (!left.size || !right.size) return 0
  let matches = 0
  for (const token of left) if (right.has(token)) matches += 1
  return matches / left.size
}

const textOf = (item = {}) => [
  item.location, item.room, item.camera, item.category, item.categoria, item.area,
  item.name, item.description, item.summary, item.symptom, item.title,
  item.note, item.completion_note, item.solution, item.cause, item.pezzo_nome,
  item.pezzo_sostituito, item.sezione,
].filter(Boolean).join(' ')

const scoreItem = (query, item) => {
  const score = overlap(query, textOf(item))
  return Number(score.toFixed(4))
}

const ranked = (query, items, limit = 5) => items
  .map((item) => ({ item: clone(item), score: scoreItem(query, item) }))
  .filter(({ score }) => score > 0)
  .sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))
  .slice(0, limit)

function safeIssueQuery(issue = {}) {
  return [issue.location, issue.category, issue.summary, issue.description, issue.urgency]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function buildRecurrence(history, query) {
  const relevant = ranked(query, history, 10).map(({ item, score }) => ({ ...item, __score: score }))
  const locations = [...new Set(relevant.map((item) => item.location || item.camera || item.room).filter(Boolean))]
  const categories = [...new Set(relevant.map((item) => item.category || item.categoria).filter(Boolean))]
  const count = relevant.length
  const recurring = count >= 2
  return {
    count,
    recurring,
    level: count >= 3 ? 'high' : recurring ? 'medium' : count === 1 ? 'low' : 'unknown',
    locations,
    categories,
    message: recurring
      ? `Trovati ${count} elementi storici correlati: verificare se esiste una causa comune.`
      : count === 1
        ? 'Trovato un precedente correlato; confrontarlo con i dati attuali.'
        : 'Nessuno storico sufficientemente correlato disponibile.',
  }
}

function buildHypotheses({ recurrence, equipment }) {
  if (!recurrence.recurring) return []
  const location = recurrence.locations.length === 1 ? ` nella zona ${recurrence.locations[0]}` : ''
  const category = recurrence.categories.length === 1 ? ` di categoria ${recurrence.categories[0]}` : ''
  return [{
    id: 'recurrent-pattern',
    label: `Possibile problema ricorrente${category}${location}`,
    confidence: recurrence.level === 'high' ? 0.62 : 0.52,
    basis: 'ricorrenza osservata nello storico correlato',
    status: 'HYPOTHESIS',
    caution: 'Ipotesi da verificare sul posto; non è una diagnosi automatica.',
    equipmentCount: equipment.length,
  }]
}

function buildNextActions({ suggestions, recurrence, equipment, memory, documents }) {
  const actions = []
  const primary = suggestions.find((item) => item.kind === 'procedure' && item.actionable)
  if (primary) actions.push({ id: 'approved-procedure', label: primary.nextAction || 'Avvia la procedura approvata.', trust: 'APPROVED' })
  if (equipment.length) actions.push({ id: 'inspect-equipment', label: 'Verifica l’impianto o l’apparecchiatura collegata prima di concludere.', trust: 'CONTEXT' })
  if (recurrence.recurring) actions.push({ id: 'compare-pattern', label: 'Confronta i precedenti e controlla se il problema coinvolge più punti.', trust: 'HISTORY' })
  if (memory.length) actions.push({ id: 'review-memory', label: 'Confronta la memoria verificata con i dati attuali; non applicarla automaticamente.', trust: 'MEMORY' })
  if (documents.length) actions.push({ id: 'open-documentation', label: 'Consulta la documentazione tecnica approvata collegata.', trust: 'DOCUMENTATION' })
  if (!actions.length) actions.push({ id: 'collect-context', label: 'Raccogli posizione precisa, sintomi, componente e stato attuale.', trust: 'MISSING_DATA' })
  return actions.slice(0, 5)
}

export function buildProjectIntelligence({
  hotelId,
  issue = {},
  equipment = [],
  history = [],
  memory = [],
  suggestions = [],
  documents = [],
  sensors = [],
} = {}) {
  if (!String(hotelId || '').trim()) throw new TypeError('hotelId is required')
  const query = safeIssueQuery(issue)
  if (!query) {
    return {
      hotelId,
      query: '',
      assessment: 'INSUFFICIENT_DATA',
      summary: 'Mancano dati sufficienti per collegare il problema al progetto tecnico.',
      relatedEquipment: [],
      relatedHistory: [],
      verifiedMemory: [],
      recurrence: buildRecurrence([], ''),
      hypotheses: [],
      signals: [],
      nextActions: buildNextActions({ suggestions: [], recurrence: { recurring: false }, equipment: [], memory: [], documents: [] }),
    }
  }

  const relatedEquipment = ranked(query, equipment, 5)
  const relatedHistory = ranked(query, history, 5)
  const verifiedMemory = ranked(query, memory, 3)
  const recurrence = buildRecurrence(history, query)
  const hypotheses = buildHypotheses({ recurrence, equipment: relatedEquipment })
  const signals = [
    relatedEquipment.length ? { id: 'equipment', label: 'Impianti collegati', value: relatedEquipment.length, trust: 'CONTEXT' } : null,
    recurrence.count ? { id: 'history', label: 'Precedenti correlati', value: recurrence.count, trust: 'HISTORY' } : null,
    verifiedMemory.length ? { id: 'memory', label: 'Memorie verificate', value: verifiedMemory.length, trust: 'VERIFIED' } : null,
    documents.length ? { id: 'documents', label: 'Documenti approvati', value: documents.length, trust: 'APPROVED' } : null,
    sensors.length ? { id: 'sensors', label: 'Dati live disponibili', value: sensors.length, trust: 'LIVE' } : null,
  ].filter(Boolean)

  const assessment = recurrence.recurring ? 'RECURRING_PATTERN'
    : relatedEquipment.length || relatedHistory.length || verifiedMemory.length ? 'CONNECTED'
      : 'ISOLATED'

  const summary = recurrence.recurring
    ? `Il problema presenta una possibile ricorrenza: ${recurrence.message}`
    : relatedEquipment.length
      ? 'Il problema è collegato a un impianto o apparecchiatura già censita.'
      : relatedHistory.length || verifiedMemory.length
        ? 'Esiste un precedente utile, ma va confrontato con la situazione attuale.'
        : 'Non emergono collegamenti sufficienti oltre alla segnalazione corrente.'

  return {
    hotelId,
    query,
    assessment,
    summary,
    relatedEquipment: relatedEquipment.map(({ item, score }) => ({ ...item, score })),
    relatedHistory: relatedHistory.map(({ item, score }) => ({ ...item, score })),
    verifiedMemory: verifiedMemory.map(({ item, score }) => ({ ...item, score })),
    recurrence,
    hypotheses,
    signals,
    nextActions: buildNextActions({ suggestions, recurrence, equipment: relatedEquipment, memory: verifiedMemory, documents }),
  }
}

export const PROJECT_INTELLIGENCE_ASSESSMENTS = Object.freeze({
  CONNECTED: 'CONNECTED',
  RECURRING_PATTERN: 'RECURRING_PATTERN',
  ISOLATED: 'ISOLATED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
})
