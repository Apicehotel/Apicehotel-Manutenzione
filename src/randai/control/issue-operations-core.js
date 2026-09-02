export const normalize = (value) => String(value || '').trim().toLowerCase()

const words = (value) => new Set(
  normalize(value)
    .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3),
)

const overlap = (a, b) => {
  const left = words(a)
  const right = words(b)
  let score = 0
  for (const token of left) if (right.has(token)) score += 1
  return score
}

export function similarScore(issue, candidate) {
  if (!issue || !candidate || issue.hotelId !== candidate.hotelId || issue.id === candidate.id) return -1
  let score = 0
  if (normalize(issue.category) && normalize(issue.category) === normalize(candidate.category)) score += 4
  if (normalize(issue.room) && normalize(issue.room) === normalize(candidate.room)) score += 3
  score += Math.min(3, overlap(`${issue.title || ''} ${issue.category || ''}`, `${candidate.title || ''} ${candidate.category || ''}`))
  if (normalize(candidate.status) === 'done') score += 1
  return score
}

export function procedureScore(issue, procedure) {
  if (!issue || !procedure || issue.hotelId !== procedure.hotel_id || procedure.status !== 'approved') return -1
  let score = 0
  if (normalize(issue.category) && normalize(issue.category) === normalize(procedure.category)) score += 5
  score += Math.min(4, overlap(
    `${issue.title || ''} ${issue.category || ''} ${issue.room || ''}`,
    `${procedure.title || ''} ${procedure.summary || ''} ${procedure.symptom || ''} ${procedure.area || ''} ${procedure.category || ''}`,
  ))
  return score
}

export function equipmentScore(issue, equipment) {
  if (!issue || !equipment || issue.hotelId !== equipment.hotel_id || equipment.active === false) return -1
  let score = 0
  if (normalize(issue.room) && normalize(equipment.location).includes(normalize(issue.room))) score += 4
  if (normalize(issue.category) && normalize(equipment.category) === normalize(issue.category)) score += 3
  score += Math.min(3, overlap(
    `${issue.title || ''} ${issue.category || ''} ${issue.room || ''}`,
    `${equipment.name || ''} ${equipment.category || ''} ${equipment.location || ''}`,
  ))
  return score
}

export function rankSimilarIssues(issue, candidates = [], { minScore = 4, limit = 6 } = {}) {
  if (!issue) return []
  return candidates
    .map((item) => ({ item, score: similarScore(issue, item) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score || new Date(b.item.completedAt || b.item.updatedAt || 0) - new Date(a.item.completedAt || a.item.updatedAt || 0))
    .slice(0, limit)
    .map((entry) => entry.item)
}

export function rankProcedures(issue, procedures = [], { minScore = 2, limit = 5 } = {}) {
  if (!issue) return []
  return procedures
    .map((item) => ({ item, score: procedureScore(issue, item) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item)
}

export function rankEquipment(issue, equipment = [], { minScore = 2, limit = 5 } = {}) {
  if (!issue) return []
  return equipment
    .map((item) => ({ item, score: equipmentScore(issue, item) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item)
}

export function relatedDocuments(issue, documents = [], procedures = [], equipment = [], limit = 8) {
  if (!issue) return []
  const procedureIds = new Set(procedures.map((item) => item.id))
  const equipmentIds = new Set(equipment.map((item) => item.id))
  return documents
    .filter((item) => item.hotel_id === issue.hotelId && (procedureIds.has(item.procedure_id) || equipmentIds.has(item.equipment_id)))
    .slice(0, limit)
}

export function buildTimeline(issue, whatsappRows = []) {
  if (!issue) return []
  const events = []
  for (const message of whatsappRows) {
    if (message.hotel_id && message.hotel_id !== issue.hotelId) continue
    if (message.issue_id && message.issue_id !== issue.id) continue
    events.push({ id: `wa-${message.id}`, time: message.received_at, title: 'Messaggio WhatsApp ricevuto', detail: message.body || 'Messaggio con allegato', tone: 'whatsapp' })
    if (message.processed_at && message.processing_status) {
      events.push({ id: `wa-process-${message.id}`, time: message.processed_at, title: `WhatsApp · ${message.processing_status}`, detail: message.reply_text || 'Messaggio elaborato e collegato alla segnalazione.' })
    }
  }
  if (issue.createdAt) events.push({ id: `created-${issue.id}`, time: issue.createdAt, title: 'Segnalazione creata', detail: `${issue.createdByName || issue.origin || 'Sistema'} · ${issue.room || 'zona non indicata'}` })
  if (issue.technicianAskedAt || issue.technicianAskedBy) events.push({ id: `tech-asked-${issue.id}`, time: issue.technicianAskedAt || issue.updatedAt, title: 'Tecnico richiesto', detail: [issue.technicianAskedBy, issue.technicianNote].filter(Boolean).join(' · ') || 'Richiesta tecnico registrata.' })
  if (issue.technicianExpectedArrival) events.push({ id: `tech-arrival-${issue.id}`, time: issue.technicianExpectedArrival, title: 'Arrivo tecnico previsto', detail: issue.technicianName || 'Tecnico esterno' })
  if (normalize(issue.status) === 'waiting' || issue.pieceName) events.push({ id: `part-${issue.id}`, time: issue.updatedAt || issue.createdAt, title: 'Ricambio / materiale', detail: issue.pieceName ? `In attesa: ${issue.pieceName}` : 'Segnalazione in attesa ricambio.' })
  if (issue.completedAt) events.push({ id: `done-${issue.id}`, time: issue.completedAt, title: 'Segnalazione risolta', detail: [issue.completedBy, issue.completionNote].filter(Boolean).join(' · ') || 'Completamento registrato.', tone: 'good' })
  return events.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0))
}

export function buildContextAnalysis(issue, similar = [], procedures = [], equipment = []) {
  if (!issue) return { facts: [], next: 'Seleziona una segnalazione.' }
  const facts = []
  if (['urgente', 'alta'].includes(normalize(issue.urgency))) facts.push('La segnalazione è già ad alta priorità.')
  if (normalize(issue.origin) === 'whatsapp') facts.push('La segnalazione proviene da WhatsApp ed è stata unificata con RandApp.')
  if (issue.technicianAskedBy || issue.technicianRequestedBy || normalize(issue.status) === 'tecnico') facts.push('È presente una richiesta o assegnazione tecnico.')
  if (normalize(issue.status) === 'waiting' || issue.pieceName) facts.push(`È in attesa di ricambio${issue.pieceName ? `: ${issue.pieceName}` : ''}.`)
  if (similar.length) facts.push(`Trovati ${similar.length} casi simili nella stessa struttura.`)
  if (procedures.length) facts.push(`Trovate ${procedures.length} procedure approvate pertinenti.`)
  if (equipment.length) facts.push(`Trovati ${equipment.length} possibili impianti correlati.`)
  if (!facts.length) facts.push('Nessuna evidenza aggiuntiva verificabile oltre ai dati della segnalazione.')

  let next = 'Verifica sul posto e raccogli dati prima di modificare lo stato.'
  if (normalize(issue.status) === 'done') next = 'Nessuna azione operativa: la segnalazione risulta risolta.'
  else if (normalize(issue.status) === 'waiting' || issue.pieceName) next = 'Verifica disponibilità del ricambio e aggiorna l’intervento quando disponibile.'
  else if (issue.technicianAskedBy || issue.technicianRequestedBy || normalize(issue.status) === 'tecnico') next = 'Segui autorizzazione, assegnazione e arrivo del tecnico senza chiudere anticipatamente.'
  else if (procedures.length) next = `Apri la procedura approvata più pertinente: “${procedures[0].title}”.`
  else if (similar.length) next = 'Confronta i casi simili risolti, senza assumere che la causa sia la stessa.'
  return { facts, next }
}
