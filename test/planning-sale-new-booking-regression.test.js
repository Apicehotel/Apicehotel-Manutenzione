import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { freshAvailabilityDecision, isValidIsoDate, previousIsoDate, validateBookingDates } from '../src/randapp/planning/sale-booking-validation.js'

test('ISO date validation rejects empty and impossible dates', () => {
  assert.equal(isValidIsoDate(''), false)
  assert.equal(isValidIsoDate('2026-02-30'), false)
  assert.equal(isValidIsoDate('2026-09-10'), true)
  assert.equal(previousIsoDate(''), '')
  assert.equal(previousIsoDate('2026-03-01'), '2026-02-28')
})

test('booking date window is fail closed', () => {
  assert.equal(validateBookingDates({ dateFrom: '', dateTo: '', prepDate: '' }).code, 'INVALID_DATE')
  assert.equal(validateBookingDates({ dateFrom: '2026-09-10', dateTo: '2026-09-09', prepDate: '2026-09-09' }).code, 'EVENT_RANGE')
  assert.equal(validateBookingDates({ dateFrom: '2026-09-10', dateTo: '2026-09-11', prepDate: '2026-09-11' }).code, 'PREP_AFTER_EVENT')
  assert.equal(validateBookingDates({ dateFrom: '2026-09-10', dateTo: '2026-09-11', prepDate: '2026-09-09' }).valid, true)
})

test('fresh availability blocks stale room selection but keeps offline queue policy', () => {
  assert.equal(freshAvailabilityDecision({ ok: true }, 'free').allowed, true)
  assert.equal(freshAvailabilityDecision({ ok: true }, 'busy').code, 'ROOM_NO_LONGER_FREE')
  assert.equal(freshAvailabilityDecision({ ok: false, offline: true }, 'busy').code, 'OFFLINE_QUEUE')
  assert.equal(freshAvailabilityDecision({ ok: false, offline: false }, 'free').allowed, false)
})

test('form rechecks server availability and separates recall failure from booking failure', () => {
  const source = fs.readFileSync(new URL('../src/randapp/planning/SaleBookingForm.jsx', import.meta.url), 'utf8')
  assert.match(source, /await fetchBookings\(hotel\.id\)/)
  assert.match(source, /freshAvailabilityDecision/)
  assert.match(source, /let recallError = null/)
  assert.match(source, /Prenotazione salvata\. Il richiamo cliente non è stato aggiornato/)
  assert.match(source, /hotel\.id, rooms\.length/)
  assert.doesNotMatch(source, /NaN-NaN-NaN/)
})
