import { isToday } from '../helpers.js'

const startOfDay = (value = Date.now()) => {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const endOfDay = (value = Date.now()) => startOfDay(value) + 24 * 60 * 60 * 1000 - 1

/** Segnalazioni: Aperte · Urgenti · Chiuse oggi */
export function issuePreviewMetrics(issues = []) {
  const open = issues.filter((item) => item.status !== 'done')
  const urgent = open.filter((item) => item.urgency === 'alta')
  const closedToday = issues.filter((item) => item.status === 'done' && isToday(item.completedAt))
  return [
    { value: open.length, label: 'Aperte' },
    { value: urgent.length, label: 'Urgenti', tone: urgent.length ? 'danger' : 'default' },
    { value: closedToday.length, label: 'Chiuse oggi', tone: 'success' },
  ]
}

/** Interventi: Oggi · Da finire · Fatti oggi */
export function interventionPreviewMetrics(items = [], now = Date.now()) {
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const scheduledToday = items.filter((item) => {
    const at = Number(item.scheduledAt || 0)
    return at >= dayStart && at <= dayEnd
  })
  const openToday = scheduledToday.filter((item) => item.status !== 'done')
  const finish = items.filter((item) => item.status === 'da_finire' || item.status === 'waiting')
  const doneToday = items.filter((item) => item.status === 'done' && isToday(item.completedAt))
  return [
    { value: openToday.length, label: 'Oggi' },
    { value: finish.length, label: 'Da finire', tone: finish.length ? 'warning' : 'default' },
    { value: doneToday.length, label: 'Fatti oggi', tone: 'success' },
  ]
}

/** Avvisi urgenti: Aperti · In carico · Chiusi oggi */
export function urgentPreviewMetrics(items = []) {
  const open = items.filter((item) => item.status === 'aperta')
  const taken = items.filter((item) => item.status === 'presa_in_carico')
  const closedToday = items.filter((item) => item.status === 'completata' && isToday(item.completedAt || item.updatedAt))
  return [
    { value: open.length, label: 'Aperti', tone: open.length ? 'danger' : 'default' },
    { value: taken.length, label: 'In carico', tone: taken.length ? 'warning' : 'default' },
    { value: closedToday.length, label: 'Chiusi oggi', tone: 'success' },
  ]
}

/**
 * Promemoria: Oggi · Attivi · Totale
 * `dueToday` should already be filtered for the current user/role when available.
 */
export function reminderPreviewMetrics(items = [], dueToday = []) {
  const active = items.filter((item) => item.active)
  return [
    { value: dueToday.length, label: 'Oggi', tone: dueToday.length ? 'warning' : 'default' },
    { value: active.length, label: 'Attivi' },
    { value: items.length, label: 'Totale' },
  ]
}

