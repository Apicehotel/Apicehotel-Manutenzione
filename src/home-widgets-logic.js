import { namesMatch } from './home-presence-logic.js'

const DONE = new Set(['done', 'completata'])

function personAssigned(item, user) {
  const name = String(user?.name || '').trim().toLowerCase()
  if (!name) return false
  return (item?.assignees || []).some((entry) => String(entry?.name || entry || '').trim().toLowerCase() === name)
}

function timeLabel(ms) {
  if (!ms) return ''
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
}

function parseReminderTime(time, day = new Date()) {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const next = new Date(day)
  next.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return next.getTime()
}

/**
 * Assigned open work for the current user (planned + urgents in carico).
 */
export function buildMyWorkPreview({ user, planned = [], urgents = [], limit = 3, now = Date.now() } = {}) {
  const rows = []

  for (const item of planned || []) {
    if (!item || DONE.has(item.status) || !personAssigned(item, user)) continue
    rows.push({
      id: `planned-${item.id}`,
      kind: 'planned',
      route: 'my-work',
      title: item.notes || item.category || item.location || 'Intervento assegnato',
      meta: [item.location, timeLabel(item.scheduledAt)].filter(Boolean).join(' · ') || 'Assegnato a te',
      status: item.status,
      sortAt: item.scheduledAt || item.updatedAt || now,
      active: ['in_progress', 'waiting', 'tecnico', 'da_finire'].includes(item.status),
    })
  }

  for (const item of urgents || []) {
    if (!item || item.status !== 'presa_in_carico' || !namesMatch(item.takenBy, user?.name)) continue
    rows.push({
      id: `urgent-${item.id}`,
      kind: 'urgent',
      route: 'urgent',
      title: item.location || item.note || 'Avviso in carico',
      meta: item.note ? String(item.note).slice(0, 80) : 'Preso in carico da te',
      status: item.status,
      sortAt: item.takenAt || item.createdAt || now,
      active: true,
    })
  }

  return rows
    .sort((a, b) => Number(b.active) - Number(a.active) || a.sortAt - b.sortAt)
    .slice(0, Math.max(0, limit))
}

/**
 * Single next commitment: soonest upcoming planned item or reminder time today.
 */
export function buildNextCommitment({
  user,
  planned = [],
  reminders = [],
  reminderDueToday = () => false,
  now = Date.now(),
} = {}) {
  const candidates = []
  const graceMs = 30 * 60 * 1000

  for (const item of planned || []) {
    if (!item || DONE.has(item.status) || !item.scheduledAt) continue
    if (item.scheduledAt < now - graceMs) continue
    candidates.push({
      id: `planned-${item.id}`,
      kind: 'intervento',
      route: 'interventions',
      eyebrow: personAssigned(item, user) ? 'Tuo intervento' : 'Prossimo intervento',
      title: item.notes || item.category || item.location || 'Intervento pianificato',
      meta: [item.location, timeLabel(item.scheduledAt)].filter(Boolean).join(' · ') || timeLabel(item.scheduledAt),
      at: item.scheduledAt,
    })
  }

  const day = new Date(now)
  for (const item of reminders || []) {
    if (!reminderDueToday(item, user, day)) continue
    const times = item.times || []
    if (!times.length) {
      candidates.push({
        id: `reminder-${item.id}`,
        kind: 'promemoria',
        route: 'reminders',
        eyebrow: 'Promemoria oggi',
        title: item.message || 'Promemoria',
        meta: 'Oggi',
        at: now + 12 * 60 * 60 * 1000,
      })
      continue
    }
    for (const time of times) {
      const at = parseReminderTime(time, day)
      if (at == null || at < now - graceMs) continue
      candidates.push({
        id: `reminder-${item.id}-${time}`,
        kind: 'promemoria',
        route: 'reminders',
        eyebrow: 'Promemoria',
        title: item.message || 'Promemoria',
        meta: `Oggi · ${time}`,
        at,
      })
    }
  }

  if (!candidates.length) return null
  return candidates.sort((a, b) => a.at - b.at)[0]
}

export function weatherSummary(weather) {
  if (!weather) return null
  const level = weather.level || 'ok'
  if (level === 'danger') {
    return {
      level,
      title: 'Allarme meteo',
      detail: weather.message || 'Controllare gli esterni',
    }
  }
  if (level === 'warning') {
    return {
      level,
      title: 'Attenzione meteo',
      detail: weather.message || 'Verifica preventiva',
    }
  }
  const wind = weather.gust || weather.wind
  const rain = weather.rainProbability
  const bits = []
  if (wind != null) bits.push(`Vento ${wind} km/h`)
  if (rain != null) bits.push(`Pioggia ${rain}%`)
  return {
    level: 'ok',
    title: 'Meteo operativo',
    detail: bits.length ? bits.join(' · ') : (weather.message || 'Condizioni ok'),
  }
}

export function syncStatusMessage(status) {
  if (!status) return null
  if (!status.online) {
    return {
      tone: 'offline',
      title: 'Sei offline',
      detail: status.pending
        ? `${status.pending} azion${status.pending === 1 ? 'e' : 'i'} in coda sul dispositivo`
        : 'Le modifiche resteranno sul dispositivo fino al ritorno rete',
    }
  }
  if (status.blocked > 0) {
    return {
      tone: 'blocked',
      title: 'Sync bloccata',
      detail: `${status.blocked} operazion${status.blocked === 1 ? 'e richiede' : 'i richiedono'} intervento`,
    }
  }
  if (status.pending > 0) {
    return {
      tone: 'pending',
      title: status.syncing ? 'Sincronizzo…' : 'Sync in coda',
      detail: `${status.pending} azion${status.pending === 1 ? 'e' : 'i'} in attesa di invio`,
    }
  }
  return null
}
