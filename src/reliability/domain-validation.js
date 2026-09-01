import {
  ValidationCode,
  combineValidation,
  dateRange,
  finiteNumber,
  isoDate,
  oneOf,
  required,
  transition,
  validationIssue,
} from './validation-engine.js'
import { INVENTORY_ITEM_TYPES, INVENTORY_MOVEMENT_TYPES } from '../inventory-domain.js'

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
    oneOf(issue.urgency || 'media', ISSUE_URGENCIES, 'urgency'),
    oneOf(issue.status || 'todo', ISSUE_STATUSES, 'status'),
  )
}

export function validateIssueUpdate(changes = {}, current = null) {
  const checks = []
  if ('hotelId' in changes) checks.push(required(changes.hotelId, 'hotelId'))
  if ('title' in changes) checks.push(required(changes.title, 'title'))
  if ('urgency' in changes) checks.push(oneOf(changes.urgency, ISSUE_URGENCIES, 'urgency'))
  if ('status' in changes) checks.push(oneOf(changes.status, ISSUE_STATUSES, 'status'))
  if (current?.status && changes.status) checks.push(transition(current.status, changes.status, ISSUE_TRANSITIONS))
  return combineValidation(...checks)
}

export function validateUrgentCreate(item = {}) {
  return combineValidation(
    required(item.hotelId, 'hotelId'),
    required(item.note, 'note'),
    oneOf(item.status || 'aperta', URGENT_STATUSES, 'status'),
    oneOf(item.severity || 'urgente', ['urgente', 'emergenza'], 'severity'),
  )
}

export function validateUrgentUpdate(changes = {}, current = null) {
  const checks = []
  if ('hotelId' in changes) checks.push(required(changes.hotelId, 'hotelId'))
  if ('note' in changes) checks.push(required(changes.note, 'note'))
  if ('status' in changes) checks.push(oneOf(changes.status, URGENT_STATUSES, 'status'))
  if ('severity' in changes) checks.push(oneOf(changes.severity, ['urgente', 'emergenza'], 'severity'))
  if (current?.status && changes.status) checks.push(transition(current.status, changes.status, URGENT_TRANSITIONS))
  return combineValidation(...checks)
}

export function validatePlanningWorkCreate({ hotelId, description, dates } = {}) {
  const list = Array.isArray(dates) ? dates : []
  const dateChecks = list.map((date, index) => isoDate(date, `dates.${index}`))
  return combineValidation(
    required(hotelId, 'hotelId'),
    required(description, 'description'),
    list.length ? [] : [validationIssue('dates', ValidationCode.REQUIRED, 'dates è obbligatorio')],
    ...dateChecks,
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
    oneOf(item.status || 'pending', BOOKING_STATUSES, 'status'),
    finiteNumber(item.pax, 'pax', { min: 0, optional: true, integer: true }),
  )
}

export function validateBookingUpdate(changes = {}) {
  const checks = []
  if ('hotelId' in changes) checks.push(required(changes.hotelId, 'hotelId'))
  if ('status' in changes) checks.push(oneOf(changes.status, BOOKING_STATUSES, 'status'))
  if ('pax' in changes) checks.push(finiteNumber(changes.pax, 'pax', { min: 0, optional: true, integer: true }))
  if (changes.dateFrom && changes.dateTo) checks.push(dateRange(changes.dateFrom, changes.dateTo))
  return combineValidation(...checks)
}

export function validateInventoryItem(hotelId, draft = {}, { partial = false } = {}) {
  const checks = [required(hotelId, 'hotelId')]
  if (!partial || 'name' in draft) checks.push(required(draft.name, 'name'))
  if (!partial || 'quantity' in draft) checks.push(finiteNumber(draft.quantity ?? 0, 'quantity', { min: 0 }))
  if (!partial || 'minQuantity' in draft) checks.push(finiteNumber(draft.minQuantity ?? 0, 'minQuantity', { min: 0 }))
  if (!partial || 'idealQuantity' in draft) checks.push(finiteNumber(draft.idealQuantity ?? 0, 'idealQuantity', { min: 0 }))
  if (!partial || 'reorderQuantity' in draft) checks.push(finiteNumber(draft.reorderQuantity ?? 0, 'reorderQuantity', { min: 0 }))
  if (!partial || 'itemType' in draft) checks.push(oneOf(draft.itemType || 'consumabile', INVENTORY_ITEM_TYPES, 'itemType'))
  return combineValidation(...checks)
}

export function validateStockAdjustment(delta, movementType = null) {
  const checks = [finiteNumber(delta, 'delta', { nonZero: true })]
  if (movementType) checks.push(oneOf(movementType, INVENTORY_MOVEMENT_TYPES, 'movementType'))
  return combineValidation(...checks)
}
