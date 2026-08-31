import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260901014500_authorization_rls_verification_matrix.sql', import.meta.url),
  'utf8',
)

const criticalTables = [
  'segnalazioni',
  'maintenance_issues',
  'interventi',
  'richieste_urgenti',
  'planning_lavori',
  'planning_lavori_giorni',
  'prenotazioni_sale',
  'inventory_items',
  'camere_giorno',
  'camere_lavoro',
  'import_camere',
  'tecnici',
]

test('authorization baseline narrows PUBLIC policies to authenticated', () => {
  assert.match(migration, /'public' = ANY \(roles\)/)
  assert.match(migration, /ALTER POLICY %I ON %I\.%I TO authenticated/)
})

test('client roles lose table-wide privileges not required by RandApp', () => {
  assert.match(migration, /REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I\.%I FROM authenticated/)
  assert.match(migration, /REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I\.%I FROM anon/)
  assert.match(migration, /privilege_type IN \('TRUNCATE', 'TRIGGER', 'REFERENCES'\)/)
})

test('critical operational tables are covered by the RLS verification matrix', () => {
  for (const table of criticalTables) {
    assert.match(migration, new RegExp(`'${table}'`), `${table} must be in the authorization baseline`)
  }
  for (const command of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    assert.match(migration, new RegExp(`'${command}'`), `${command} must be verified`)
  }
})

test('database baseline fails closed and is not callable by client roles', () => {
  assert.match(migration, /AUTHZ_BASELINE_FAILED/)
  assert.match(migration, /SELECT public\.assert_randapp_authorization_baseline\(\)/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.assert_randapp_authorization_baseline\(\) FROM PUBLIC/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.assert_randapp_authorization_baseline\(\) TO service_role/)
})
