import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260828083000_point9_operational_health.sql')
const diagnostics = read('src/diagnostics-client.js')
const telemetry = read('src/external-telemetry.js')
const panel = read('src/randapp/admin/DiagnosticsTab.jsx')
const main = read('src/main.jsx')
const pkg = JSON.parse(read('package.json'))

test('point 9: production health is admin-only and covers critical services', () => {
  assert.match(migration, /get_operational_health\(p_hotel_id text\)/)
  assert.match(migration, /can_admin_hotel\(p_hotel_id\)/)
  for (const area of ['weather_alert_state', 'sensori_temperatura', 'urgent_reminder_jobs', 'promemoria_invio', 'notification_outbox', 'diagnostic_events', 'push_subscriptions', 'cron.job']) {
    assert.match(migration, new RegExp(area.replace('.', '\\.')))
  }
  assert.match(migration, /revoke all on function public\.get_operational_health\(text\) from public, anon/)
})

test('point 9: repeated errors become incidents instead of an unreadable event flood', () => {
  assert.match(migration, /get_diagnostic_incidents/)
  assert.match(migration, /count\(\*\) as occurrences/)
  assert.match(migration, /min\(d\.created_at\)/)
  assert.match(migration, /max\(d\.created_at\)/)
  assert.match(diagnostics, /fetchDiagnosticIncidents/)
  assert.match(panel, /Incidenti raggruppati/)
})

test('point 9: safe recovery is narrow and administrator controlled', () => {
  assert.match(migration, /retry_failed_urgent_job/)
  assert.match(migration, /status='failed'/)
  assert.match(migration, /set status='pending', attempts=0, last_error=null/)
  assert.match(diagnostics, /retryFailedUrgentJob/)
  assert.match(diagnostics, /repairPushForHotel/)
  assert.match(panel, /Rimetti in coda/)
  assert.match(panel, /Ripara push/)
})

test('point 9: Sentry and OpenTelemetry are installed but remain opt-in', () => {
  assert.equal(pkg.dependencies['@sentry/react'], '10.71.0')
  assert.equal(pkg.dependencies['@opentelemetry/api'], '1.9.1')
  assert.equal(pkg.dependencies['@opentelemetry/sdk-trace-web'], '2.10.0')
  assert.equal(pkg.dependencies['@opentelemetry/exporter-trace-otlp-http'], '0.221.0')
  assert.match(telemetry, /VITE_SENTRY_ENABLED/)
  assert.match(telemetry, /VITE_OTEL_ENABLED/)
  assert.match(telemetry, /sendDefaultPii: false/)
  assert.match(telemetry, /beforeSend/)
  assert.match(main, /import\('\.\/external-telemetry\.js'\)/)
})

test('point 9: external telemetry stays out of the eager application imports', () => {
  assert.doesNotMatch(main, /from ['"]@sentry\/react['"]/)
  assert.doesNotMatch(main, /from ['"]@opentelemetry\//)
  assert.match(telemetry, /await import\('@sentry\/react'\)/)
  assert.match(telemetry, /import\('@opentelemetry\/sdk-trace-web'\)/)
})

test('point 9: diagnostics exposes a single operational state plus 3.0 readiness', () => {
  assert.match(panel, /Stato RandApp/)
  assert.match(panel, /Produzione/)
  assert.match(panel, /Worker pianificati/)
  assert.match(panel, /Preparazione RandApp 3\.0/)
  assert.match(panel, /Sentry/)
  assert.match(panel, /OpenTelemetry/)
})
