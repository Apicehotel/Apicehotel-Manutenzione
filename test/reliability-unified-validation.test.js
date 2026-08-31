import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  OperationValidationError,
  ValidationCode,
  assertValid,
  combineValidation,
  required,
} from '../src/reliability/validation-engine.js'
import {
  validateBookingCreate,
  validateInventoryItem,
  validateIssueCreate,
  validateIssueUpdate,
  validatePlanningWorkCreate,
  validatePlanningWorkStatus,
  validateStockAdjustment,
  validateUrgentCreate,
  validateUrgentUpdate,
} from '../src/reliability/domain-validation.js'

const codes = (result) => result.issues.map((item) => item.code)

test('validation engine returns stable machine-readable failures', () => {
  const result = combineValidation(required('', 'hotelId'))
  assert.equal(result.ok, false)
  assert.deepEqual(codes(result), [ValidationCode.REQUIRED])
  assert.throws(
    () => assertValid(result),
    (error) => error instanceof OperationValidationError && error.code === 'OPERATION_VALIDATION_FAILED',
  )
})

test('issue contract validates required scope and operational enums', () => {
  assert.equal(validateIssueCreate({ hotelId: 'hotelgio', room: '1114', title: 'Lampada', urgency: 'alta', status: 'todo' }).ok, true)
  const invalid = validateIssueCreate({ hotelId: 'hotelgio', room: '', title: '', urgency: 'estrema', status: 'x' })
  assert.equal(invalid.ok, false)
  assert.ok(codes(invalid).includes(ValidationCode.REQUIRED))
  assert.ok(codes(invalid).includes(ValidationCode.INVALID_VALUE))
})

test('issue transition contract can reject reopening a terminal state when current state is known', () => {
  const result = validateIssueUpdate({ status: 'doing' }, { status: 'done' })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes(ValidationCode.INVALID_STATE_TRANSITION))
})

test('urgent contract rejects invalid severity and invalid terminal transition', () => {
  assert.equal(validateUrgentCreate({ hotelId: 'hotelgio', note: 'Acqua', severity: 'emergenza' }).ok, true)
  assert.equal(validateUrgentCreate({ hotelId: 'hotelgio', note: 'Acqua', severity: 'massima' }).ok, false)
  const transition = validateUrgentUpdate({ status: 'aperta' }, { status: 'completata' })
  assert.ok(codes(transition).includes(ValidationCode.INVALID_STATE_TRANSITION))
})

test('planning work requires at least one valid date and a supported status', () => {
  assert.equal(validatePlanningWorkCreate({ hotelId: 'hotelgio', description: 'Controllo', dates: ['2026-09-01'] }).ok, true)
  assert.equal(validatePlanningWorkCreate({ hotelId: 'hotelgio', description: 'Controllo', dates: [] }).ok, false)
  assert.equal(validatePlanningWorkCreate({ hotelId: 'hotelgio', description: 'Controllo', dates: ['non-data'] }).ok, false)
  assert.equal(validatePlanningWorkStatus('done').ok, true)
  assert.equal(validatePlanningWorkStatus('chiuso').ok, false)
})

test('sale booking validates chronological dates and non-negative integer pax', () => {
  assert.equal(validateBookingCreate({ hotelId: 'hotelgio', room: 'Sala A', dateFrom: '2026-09-01', dateTo: '2026-09-02', pax: 20 }).ok, true)
  assert.equal(validateBookingCreate({ hotelId: 'hotelgio', room: 'Sala A', dateFrom: '2026-09-02', dateTo: '2026-09-01', pax: 20 }).ok, false)
  assert.equal(validateBookingCreate({ hotelId: 'hotelgio', room: 'Sala A', dateFrom: '2026-09-01', pax: -1 }).ok, false)
})

test('inventory rejects negative quantities and zero stock movements', () => {
  assert.equal(validateInventoryItem('hotelgio', { name: 'Lampadina', quantity: 1, minQuantity: 0 }).ok, true)
  assert.equal(validateInventoryItem('hotelgio', { name: 'Lampadina', quantity: -1, minQuantity: 0 }).ok, false)
  assert.equal(validateStockAdjustment(0).ok, false)
  assert.equal(validateStockAdjustment(-2).ok, true)
})

test('critical data layers wire the common validator before writes', () => {
  const inventory = fs.readFileSync(new URL('../src/inventory-data.js', import.meta.url), 'utf8')
  const planning = fs.readFileSync(new URL('../src/planning-work-data.js', import.meta.url), 'utf8')
  assert.match(inventory, /assertValid\(validateInventoryItem/)
  assert.match(inventory, /assertValid\(validateStockAdjustment/)
  assert.match(planning, /assertValid\(validatePlanningWorkCreate/)
  assert.match(planning, /assertValid\(validatePlanningWorkStatus/)
})

test('validation layer remains dependency-free', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(Boolean(pkg.dependencies?.zod), false)
  assert.equal(Boolean(pkg.dependencies?.xstate), false)
})
