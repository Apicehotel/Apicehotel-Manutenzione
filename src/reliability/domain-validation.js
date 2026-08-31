import {
  combineValidation,
  dateRange,
  finiteNumber,
  maxLength,
  oneOf,
  required,
  transition,
  validationResult,
} from './validation-engine.js'

export const ISSUE_STATUSES = Object.freeze(['todo', 'doing', 'waiting', 'tecnico', 'done'])
export const ISSUE_URGENCIES = Object.freeze(['alta', 'media', 'bassa'])
export const ISSUE_TRANSITIONS = Object.freeze({
  todo: Object.freeze(['doing', 'waiting', 'tecnico', 'done']),
  doing: Object.freeze(['todo', 'waiting', 'tecnico', 'done']),
  waiting: Object.freeze(['todo', 'doing', 'tecnico', 'done']),
  tecnico: Object.freeze(['todo', 'doing', 'waiting', 'done']),
  done: Object.freeze([]),
})

export const URGENT_STATUSES = Object.freeze(['aperta', 'presa_in_carico', 'completata'])
export const URGENT_TRANSITIONS = Object.freeze({
  aperta: Object.freeze(['presa_in_carico', 'completata']),
  presa_in_carico: Object.freeze(['completata']),
  completata: Object.freeze([]),
})

export const PLANNING_WORK_STATUSES = Object.freeze(['pending', 'da_finire', 'done'])
export const BOOKING_STATUSES = Object.freeze(['pending', 'da_finire', 'done'])

export function validateIssueCreate(issue = {}) {
  return combineValidation(
    required(issue.hotelId, 'hotelId'),
    required(issue.room, 'room'),
    required(issue.title, 'title'),
    maxLength(issue.title, 2000, 'title'),
    oneOf(issue.urgency, ISSUE_URGENCIES, 'urgency'),
    oneOf(issue.status || 'todo', ISSUE_STATUSES, 'status'),
    maxLength(issue.category, 120, 'category'),
  )
}

export function validateIssueUpdate(changes = {}, current = null) {
  const checks = []
  if ('hotelId' in changes) checks.push(required(changes.hotelId, 'hotelId'))
  if ('title' in changes) checks.push(required(changes.title, 'title'), maxLength(changes.title, 2000, 'title'))
  if ('urgency' in changes) checks.push(oneOf(changes.urgency, ISSUE_URGENCIES, 'urgency'))
  if ('status' in changes) checks.push(oneOf(changes.status, ISSUE_STATUSES, 'status'))
  if ('category' in changes) checks.push(maxLength(changes.category, 120, 'category'))
  if (current?.status && changes.status) checks.push(transition(current.status, changes.status, ISSUE_TRANSITIONS))
  return combineValidation(...checks)
}

export function validateUrgentCreate(item = {}) {
  return combineValidation(
    required(item.hotelId, 'hotelId'),
    required(item.note, 'note'),
    maxLength(item.note, 2000, 'note'),
    oneOf(item.status || 'aperta', URGENT_STATUSES, 'status'),
    oneOf(item.severity || 'urgente', ['urgente', 'emergenza'], 'severity'),
    maxLength(item.location, 180, 'location'),
  )
}

export function validateUrgentUpdate(changes = {}, current = null) {
  const checks = []
  if ('hotelId' in changes) checks.push(required(changes.hotelId, 'hotelId'))
  if ('note' in changes) checks.push(required(changes.note, 'note'), maxLength(changes.note, 2000, 'note'))
  if ('status' in changes) checks.push(oneOf(changes.status, URGENT_STATUSES, 'status'))
  if ('severity' in changes) checks.push(oneOf(changes.severity, ['urgente', 'emergenza'], 'severity'))
  if (current?.status && changes.status) checks.push(transition(current.status, changes.status, URGENT_TRANSITIONS))
  return combineValidation(...checks)
}

export function validatePlanningWorkCreate({ hotelId, description, dates } = {}) {
  const list = Array.isArray(dates) ? dates : []
  return combineValidation(
    required(hotelId, 'hotelId'),
    required(description, 'description'),
    maxLength(description, 2000, 'description'),
    list.length ? [] : [{ path: 'dates', code: 'REQUIRED', message: 'dates è obbligatorio' }],
    ...list.map((date, index) => Number.isFinite(Date.parse(date)) ? [] : [{ path: `dates.${index}`, code: 'INVALID_DATE', message: 'Data non valida' }]),
  )
}

export function validatePlanningWorkStatus(status) {
  return combineValidation(oneOf(status, PLANNING_WORK_STATUSES, 'status'))
}

export function validateBookingCreate(item = {}) {
  return combineValidation(
    required(item.hotelId, 'hotelId'),
    required(item.room, 'room'),
    required(item.dateFrom, 'dateFrom'),
    required(item.dateTo || item.dateFrom, 'dateTo'),
    dateRange(item.dateFrom, item.dateTo || item.dateFrom),
    maxLength(item.client, 200, 'client'),
    maxLength(item.notes, 2000, 'notes'),
    oneOf(item.status || 'pending', BOOKING_STATUSES, 'status'),
    finiteNumber(item.pax, 'pax', { min: 0, max: 10000, optional: true, integer: true }),
  )
}

export function validateBookingUpdate(changes = {}) {
  const checks = []
  if ('hotelId' in changes) checks.push(required(changes.hotelId, 'hotelId'))
  if ('status' in changes) checks.push(oneOf(changes.status, BOOKING_STATUSES, 'status'))
  if ('pax' in changes) checks.push(finiteNumber(changes.pax, 'pax', { min: 0, max: 10000, optional: true, integer: true }))
  if ('notes' in changes) checks.push(maxLength(changes.notes, 2000, 'notes'))
  if (changes.dateFrom && changes.dateTo) checks.push(dateRange(changes.dateFrom, changes.dateTo))
  return combineValidation(...checks)
}

export function validateInventoryItem(hotelId, draft = {}, { partial = false } = {}) {
  const checks = [required(hotelId, 'hotelId')]
  if (!partial || 'name' in draft) checks.push(required(draft.name, 'name'), maxLength(draft.name, 180, 'name'))
  if ('category' in draft) checks.push(maxLength(draft.category, 120, 'category'))
  if ('unit' in draft) checks.push(maxLength(draft.unit, 40, 'unit'))
  if ('location' in draft) checks.push(maxLength(draft.location, 180, 'location'))
  if ('sku' in draft) checks.push(maxLength(draft.sku, 120, 'sku'))
  if ('notes' in draft) checks.push(maxLength(draft.notes, 2000, 'notes'))
  if (!partial || 'quantity' in draft) checks.push(finiteNumber(draft.quantity ?? 0, 'quantity', { min: 0 }))
  if (!partial || 'minQuantity' in draft) checks.push(finiteNumber(draft.minQuantity ?? 0, 'minQuantity', { min: 0 }))
  return combineValidation(...checks)
}

export function validateStockAdjustment(delta, note = '') {
  return combineValidation(
    finiteNumber(delta, 'delta', { nonZero: true }),
    maxLength(note, 500, 'note'),
  )
}

export function validateNoop() {
  return validationResult([])
}
