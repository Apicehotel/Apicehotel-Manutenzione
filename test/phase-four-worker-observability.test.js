import test from 'node:test'
import assert from 'node:assert/strict'
import { workerHealth } from '../src/randai/control/control-center-core.js'

test('Fase 4: worker cron riuscito ma fermo diventa Stale', () => {
  const now = Date.parse('2026-09-15T12:00:00Z')
  const health = workerHealth({
    schedule: '*/30 * * * *',
    last_run: { status: 'succeeded', start_time: '2026-09-15T10:00:00Z' },
    recent_failures: 0,
  }, { now })
  assert.deepEqual(health, { state: 'warn', label: 'Stale' })
})

test('Fase 4: errore e mai eseguito restano prioritari rispetto alla freschezza', () => {
  assert.deepEqual(workerHealth({ schedule: '*/5 * * * *' }), { state: 'warn', label: 'Mai eseguito' })
  assert.deepEqual(workerHealth({ schedule: '*/5 * * * *', last_run: { status: 'failed', start_time: new Date().toISOString() }, recent_failures: 1 }), { state: 'bad', label: 'Errore' })
})

test('Fase 4: worker event-driven non viene dichiarato stale', () => {
  const health = workerHealth({ event_driven: true, expected_schedule: '30 seconds', last_run: { status: 'succeeded', start_time: '2020-01-01T00:00:00Z' } }, { now: Date.now() })
  assert.deepEqual(health, { state: 'good', label: 'OK' })
})
