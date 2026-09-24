const clean = (value) => String(value ?? '').trim()

const statusLabel = (status) => ({
  todo: 'Da fare', pending: 'Da fare', in_progress: 'In lavorazione',
  waiting: 'Attesa pezzo', tecnico: 'Attesa tecnico', done: 'Completata',
})[status] || clean(status) || 'In lavorazione'

const event = (id, title, options = {}) => ({
  id, title, detail: options.detail || '', actor: options.actor || '', at: options.at || null,
  tone: options.tone || 'default', media: options.media || null, current: Boolean(options.current),
})

const partLabel = (part) => clean(part.requestedName) || clean(part.itemName) || 'Ricambio'
const partDetail = (part) => {
  const pieces = []
  if (Number(part.quantity || 0)) pieces.push(`Quantità ${Number(part.quantity)}`)
  if (clean(part.note)) pieces.push(clean(part.note))
  return pieces.join(' · ')
}

export function buildIssueTimeline(issue = {}) {
  const events = [event('reported', 'Segnalata', {
    actor: issue.createdByName || issue.origin || 'App',
    at: issue.createdAt,
    detail: [issue.category, issue.department].filter(Boolean).join(' · '),
    media: issue.photoData || issue.photoPath || null,
    tone: 'info',
  })]
  if (issue.pieceName) {
    const decision = issue.pieceDecision === 'ritiro' ? 'Ritiro previsto' : issue.pieceDecision === 'ordine' ? 'Ordine previsto' : ''
    events.push(event('piece-requested', 'Ricambio richiesto', {
      detail: [issue.pieceName, decision].filter(Boolean).join(' · '),
      actor: issue.pieceDecisionBy || '', current: issue.status === 'waiting', tone: 'warning',
    }))
  }
  if (issue.pieceReplaced) events.push(event('piece-replaced', 'Ricambio sostituito', {
    detail: issue.pieceReplaced, actor: issue.pieceReplacedBy || '', tone: 'success',
  }))
  if (issue.technicianAskedBy || issue.technicianRequestedBy || issue.technicianName || issue.status === 'tecnico') {
    events.push(event('technician', issue.technicianName ? 'Tecnico assegnato' : 'Tecnico richiesto', {
      detail: [issue.technicianName, issue.technicianNote].filter(Boolean).join(' · '),
      actor: issue.technicianRequestedBy || issue.technicianAskedBy || '',
      at: issue.technicianRequestedAt || issue.technicianAskedAt || null,
      current: issue.status === 'tecnico', tone: 'info',
    }))
  }
  if (issue.status === 'done' || issue.completedAt) {
    events.push(event('completed', 'Completata', {
      detail: issue.completionNote || '', actor: issue.completedBy || '', at: issue.completedAt,
      media: issue.completionPhotoData || issue.completionPhotoPath || null, current: true, tone: 'success',
    }))
  } else if (issue.status === 'todo') {
    events.push(event('current', 'Da fare', {
      detail: issue.pieceName || issue.technicianName ? 'Pronta per il prossimo intervento' : 'Segnalazione aperta',
      current: true, tone: 'current',
    }))
  } else if (issue.status === 'waiting' && !issue.pieceName) events.push(event('current', 'Attesa pezzo', { current: true, tone: 'warning' }))
  else if (issue.status === 'tecnico' && !(issue.technicianAskedBy || issue.technicianRequestedBy || issue.technicianName)) events.push(event('current', 'Attesa tecnico', { current: true, tone: 'info' }))
  return events
}

export function buildInterventionTimeline(item = {}, parts = []) {
  const events = [event('created', 'Intervento creato', { actor: item.createdBy || '', at: item.createdAt, tone: 'info' })]
  if (item.scheduledAt) events.push(event('scheduled', 'Programmato', {
    at: item.scheduledAt, detail: item.scheduledUntil ? 'Finestra di lavoro programmata' : '', tone: 'info',
  }))
  if (Array.isArray(item.assignees) && item.assignees.length) events.push(event('assigned', 'Assegnato', {
    detail: item.assignees.map((person) => person?.name || person).filter(Boolean).join(', '), tone: 'info',
  }))
  const partEvents = []
  for (const part of parts || []) {
    const detail = partDetail(part), name = partLabel(part), full = [name, detail].filter(Boolean).join(' · ')
    if (part.createdAt) partEvents.push(event(`part-${part.id}-requested`, 'Ricambio richiesto', { at: part.createdAt, detail: full, tone: 'warning' }))
    if (part.reservedAt) partEvents.push(event(`part-${part.id}-reserved`, 'Ricambio prenotato', { at: part.reservedAt, detail: full, tone: 'info' }))
    if (part.consumedAt) partEvents.push(event(`part-${part.id}-consumed`, 'Ricambio usato', { at: part.consumedAt, detail: full, tone: 'success' }))
    if (part.releasedAt) partEvents.push(event(`part-${part.id}-released`, 'Ricambio rilasciato', { at: part.releasedAt, detail: full, tone: 'default' }))
  }
  partEvents.sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime()); events.push(...partEvents)
  if (item.toFinishAt || item.toFinishBy) events.push(event('to-finish','Da completare',{actor:item.toFinishBy||'',at:item.toFinishAt,tone:'warning'}))
  if (item.status === 'done' || item.completedAt) events.push(event('completed','Intervento completato',{
    actor:item.completedBy||'',at:item.completedAt,detail:item.pieceReplaced?`Ricambi: ${item.pieceReplaced}`:'',
    media:item.photoAfter||item.photoAfterPath||null,current:true,tone:'success',
  }))
  else events.push(event('current',statusLabel(item.status),{detail:item.notes?'Intervento ancora aperto':'',current:true,tone:'current'}))
  return events
}

export function formatOperationalEventTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
}
