import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { anomalySummary, nextCronRun, observedCost, workerHealth } from '../src/randai/control/control-center-core.js'

const control = await readFile(new URL('../src/randai/control/SystemControlConsole.jsx', import.meta.url), 'utf8')
const shell = await readFile(new URL('../src/randai/control/RandAIControlCenter.jsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20260902051500_randai_point5_control_center.sql', import.meta.url), 'utf8')

test('Point 5 modules are connected', () => {
  assert.match(shell, /SystemControlConsole/)
  for (const mode of ['workers','audit','rules','anomalies','observability']) assert.match(shell, new RegExp(`mode=["']${mode}["']`))
  for (const label of ['Regole','Anomalie','Costi & Osservabilità']) assert.match(shell, new RegExp(label))
})

test('snapshot is authenticated and hotel scoped', () => {
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /can_access_admin=true/)
  assert.match(migration, /hotel_scope_denied/)
  assert.match(migration, /cron\.job_run_details/)
  assert.match(migration, /randai_action_gateway_settings/)
  assert.match(migration, /randai_autonomy_policies/)
  assert.match(migration, /operational_audit_log/)
  assert.match(migration, /randai_action_audit/)
})

test('worker retry supports only the two operational scheduled workers', () => {
  assert.match(migration, /weather-alert-worker-2h-daytime/)
  assert.match(migration, /sync-sensori-temperatura-secure/)
  assert.match(migration, /worker_retry_not_allowed/)
  assert.match(control, /retryable = new Set/)
})

test('production cron forms have deterministic next runs', () => {
  const base = new Date('2026-09-02T05:01:00Z')
  assert.equal(nextCronRun('*/30 * * * *', base)?.toISOString(), '2026-09-02T05:30:00.000Z')
  assert.equal(nextCronRun('0 * * * *', base)?.toISOString(), '2026-09-02T06:00:00.000Z')
  assert.equal(nextCronRun('0 5,7,9,11,13,15,17,19 * * *', base)?.toISOString(), '2026-09-02T07:00:00.000Z')
  assert.equal(nextCronRun('17 3 * * *', base)?.toISOString(), '2026-09-03T03:17:00.000Z')
  assert.equal(nextCronRun('0 1 * * 1', base), null)
})

test('health anomaly and cost helpers use recorded evidence', () => {
  assert.deepEqual(workerHealth({ last_run: { status: 'succeeded' }, recent_failures: 0 }), { state: 'good', label: 'OK' })
  assert.equal(workerHealth({ last_run: { status: 'failed' }, recent_failures: 1 }).state, 'bad')
  assert.deepEqual(anomalySummary([{ severity: 'high' }, { severity: 'high' }, { severity: 'medium' }]), { high: 2, medium: 1 })
  assert.equal(observedCost({ cost_available: false, cost_usd: null }).available, false)
  assert.equal(observedCost({ cost_available: true, cost_usd: '0.125' }).label, '$0.1250')
})
