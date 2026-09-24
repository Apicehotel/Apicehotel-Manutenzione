const event = (id, title, options = {}) => ({
  id,
  title,
  detail: options.detail || '',
  actor: options.actor || '',
  at: options.at || null,
  tone: options.tone || 'default',
  current: Boolean(options.current),
})

export function buildUrgentTaskTimeline(item = {}) {
  const events = [event('created', 'Avviso creato', {
    actor: item.createdBy || '',
    at: item.createdAt,
    detail: [item.location, item.department].filter(Boolean).join(' · '),
    tone: 'info',
  })]
  if (item.takenBy || item.takenAt) events.push(event('taken', 'Preso in carico', {
    actor: item.takenBy || '',
    at: item.takenAt,
    tone: 'info',
  }))
  if (item.transformedIssueId) events.push(event('transformed', 'Trasformato in segnalazione', {
    detail: `Segnalazione collegata #${item.transformedIssueId}`,
    tone: 'info',
  }))
  if (item.completedBy || item.completedAt || item.status === 'completata') events.push(event('completed', 'Avviso completato', {
    actor: item.completedBy || '',
    at: item.completedAt,
    current: true,
    tone: 'success',
  }))
  else events.push(event('current', item.status === 'presa_in_carico' ? 'In lavorazione' : 'Aperto', {
    current: true,
    tone: 'current',
  }))
  return events
}

export function buildReminderTaskTimeline(item = {}) {
  const events = [event('created', 'Promemoria creato', {
    actor: item.created_by_name || '',
    at: item.created_at || null,
    detail: item.repeat_kind ? `Ripetizione: ${item.repeat_kind}` : '',
    tone: 'info',
  })]
  if (item.updated_at && item.updated_at !== item.created_at) events.push(event('updated', 'Promemoria aggiornato', {
    at: item.updated_at,
    tone: 'info',
  }))
  events.push(event('current', item.active ? 'Attivo' : 'In pausa', {
    detail: (item.times || []).join(' · '),
    current: true,
    tone: item.active ? 'current' : 'warning',
  }))
  return events
}

export function buildSupplyTimeline(request = {}) {
  const events = [event('created', 'Richiesta inviata', {
    actor: request.requested_by_name || '',
    at: request.created_at || null,
    detail: [request.area_label, request.floor_label].filter(Boolean).join(' · '),
    tone: 'info',
  })]
  const resolved = (request.supply_request_items || [])
    .filter((item) => item.resolved_at)
    .map((item) => event(`item-${item.id}`, item.status === 'delivered' ? 'Prodotto consegnato' : 'Prodotto mancante', {
      detail: item.product_name || '',
      actor: item.resolved_by_name || '',
      at: item.resolved_at,
      tone: item.status === 'delivered' ? 'success' : 'warning',
    }))
    .sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime())
  events.push(...resolved)
  if (request.completed_at) events.push(event('completed', 'Richiesta completata', {
    at: request.completed_at,
    current: true,
    tone: 'success',
  }))
  else events.push(event('current', 'In attesa', {
    detail: `${(request.supply_request_items || []).filter((item)=>item.status==='pending').length} voci da gestire`,
    current: true,
    tone: 'current',
  }))
  return events
}
