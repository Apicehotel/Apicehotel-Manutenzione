import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeObservability } from '../src/randai/observability/insights.js'

test('summarizes only the selected hotel and exposes latency, errors and cost', () => {
  const result = summarizeObservability({
    hotelId: 'hotelgio',
    now: '2026-09-03T12:00:00.000Z',
    traces: [
      { id: 'gio-ok', hotelId: 'hotelgio', status: 'SUCCEEDED', startedAt: '2026-09-03T11:59:00.000Z', endedAt: '2026-09-03T11:59:02.000Z', spans: [], events: [], metadata: { costUsd: 0.12 } },
      { id: 'other', hotelId: 'chocohotel', status: 'FAILED', startedAt: '2026-09-03T11:00:00.000Z', endedAt: '2026-09-03T11:00:01.000Z', spans: [], events: [{ type: 'error', data: { code: 'OTHER_ONLY' } }], metadata: { costUsd: 4 } },
    ],
  })
  assert.equal(result.health, 'HEALTHY')
  assert.equal(result.counts.traces, 1)
  assert.equal(result.scope.excluded, 1)
  assert.equal(result.successRate, 1)
  assert.equal(result.latencyMs.p95, 2000)
  assert.equal(result.costUsd.total, 0.12)
  assert.deepEqual(result.topErrors, [])
})

test('marks stale running traces and failed errors as degraded', () => {
  const result = summarizeObservability({
    hotelId: 'hotelgio',
    now: '2026-09-03T12:00:00.000Z',
    traces: [
      { id: 'stale', status: 'RUNNING', startedAt: '2026-09-03T10:00:00.000Z', spans: [], events: [], metadata: { hotelId: 'hotelgio' } },
      { id: 'failed', status: 'FAILED', startedAt: '2026-09-03T11:00:00.000Z', endedAt: '2026-09-03T11:01:00.000Z', spans: [], events: [{ type: 'error', data: { code: 'TIMEOUT' } }], metadata: { hotelId: 'hotelgio' } },
    ],
  })
  assert.equal(result.health, 'DEGRADED')
  assert.equal(result.counts.stale, 1)
  assert.equal(result.topErrors[0].code, 'TIMEOUT')
  assert.equal(result.recommendations.length, 2)
})

test('requires explicit hotel scope and reports no data safely', () => {
  assert.throws(() => summarizeObservability({ traces: [] }), /hotelId/)
  const result = summarizeObservability({ hotelId: 'brigantino', traces: [] })
  assert.equal(result.health, 'NO_DATA')
  assert.equal(result.recommendations[0].id, 'no-data')
})
