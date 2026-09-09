export const ADD_ACTION_DEFS = {
  issue: { id: 'issue', icon: 'issues', title: 'Nuova segnalazione', subtitle: 'Guasto, camera, zona o problema da gestire' },
  urgent: { id: 'urgent', icon: 'warning', title: 'Nuovo allarme', subtitle: 'Crea un avviso urgente per la struttura' },
  intervention: { id: 'intervention', icon: 'wrench', title: 'Nuovo intervento', subtitle: 'Crea e assegna un intervento operativo' },
  'planning-work': { id: 'planning-work', icon: 'wrench', title: 'Nuovo lavoro', subtitle: 'Aggiungi un lavoro al Planning lavori' },
  'planning-sale': { id: 'planning-sale', icon: 'hotel', title: 'Nuova attività sala', subtitle: 'Aggiungi una prenotazione o attività al Planning sale' },
  technician: { id: 'technician', icon: 'phone', title: 'Nuovo tecnico', subtitle: 'Aggiungi un tecnico esterno alla struttura attiva' },
}

const clean = (ids, capabilities) => ids.filter((id) => Boolean(capabilities?.[id]))

export function contextualAddActionIds(view, capabilities = {}) {
  switch (view) {
    case 'home':
      return []
    case 'issues':
      return clean(['issue'], capabilities)
    case 'interventions':
    case 'my-work':
      return clean(['intervention'], capabilities)
    case 'planning-work':
      return clean(['planning-work'], capabilities)
    case 'planning-sale':
      return clean(['planning-sale'], capabilities)
    case 'urgent':
      return clean(['urgent'], capabilities)
    case 'technicians':
      return clean(['technician'], capabilities)
    default:
      return []
  }
}

export function contextualAddActions(view, capabilities = {}) {
  return contextualAddActionIds(view, capabilities).map((id) => ADD_ACTION_DEFS[id]).filter(Boolean)
}

export function contextualAddLabel(actions = []) {
  if (actions.length === 1) return actions[0].title
  return actions.length > 1 ? 'Nuovo inserimento' : ''
}

export const LOCAL_CREATE_VIEWS = new Set([
  'inventory',
  'supplies',
  'reminders',
  'housekeeping',
  'temperature',
  'plants',
  'feedback',
  'feedback-received',
  'profile',
  'pin',
  'manual',
])
