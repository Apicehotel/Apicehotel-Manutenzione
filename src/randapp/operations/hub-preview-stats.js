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



const asTime = (value) => {
  const numeric = Number(value || 0)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

/** Top 3 Segnalazioni: urgenti aperte prima, poi aperte più recenti. */
export function issueTopPreview(issues = [], limit = 3) {
  return issues
    .filter((item) => item.status !== 'done')
    .sort((a, b) => {
      const urgencyA = a.urgency === 'alta' ? 1 : 0
      const urgencyB = b.urgency === 'alta' ? 1 : 0
      if (urgencyA !== urgencyB) return urgencyB - urgencyA
      return asTime(b.createdAt || b.updatedAt) - asTime(a.createdAt || a.updatedAt)
    })
    .slice(0, limit)
}

/** Top 3 Interventi: da finire/in attesa prima, poi aperti con data più vicina. */
export function interventionTopPreview(items = [], limit = 3) {
  const priority = (status) => (status === 'da_finire' || status === 'waiting' ? 0 : 1)
  return items
    .filter((item) => item.status !== 'done')
    .sort((a, b) => {
      const byPriority = priority(a.status) - priority(b.status)
      if (byPriority) return byPriority
      const aTime = asTime(a.scheduledAt)
      const bTime = asTime(b.scheduledAt)
      if (!aTime && !bTime) return asTime(b.createdAt) - asTime(a.createdAt)
      if (!aTime) return 1
      if (!bTime) return -1
      return aTime - bTime
    })
    .slice(0, limit)
}
