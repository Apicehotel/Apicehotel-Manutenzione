import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const auditMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260901020500_audit_reversible_operations.sql', import.meta.url),
  'utf8',
)
const compatibilityMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260901020800_block38_delete_compatibility.sql', import.meta.url),
  'utf8',
)

const reversibleTables = ['segnalazioni', 'interventi', 'planning_lavori', 'planning_lavori_giorni']

test('operational audit is append-only for browser roles and scoped to hotel admins', () => {
  assert.match(auditMigration, /create table if not exists public\.operational_audit_log/)
  assert.match(auditMigration, /revoke insert, update, delete, truncate, references, trigger on public\.operational_audit_log from anon, authenticated/)
  assert.match(auditMigration, /public\.can_admin_hotel\(hotel_id\)/)
  assert.match(auditMigration, /before_state jsonb/)
  assert.match(auditMigration, /after_state jsonb/)
  assert.match(auditMigration, /operation_id text not null/)
})

test('audit trigger records create update soft delete restore and hard-delete attempts', () => {
  assert.match(auditMigration, /v_action := 'soft_delete'/)
  assert.match(auditMigration, /v_action := 'restore'/)
  assert.match(auditMigration, /v_action := 'hard_delete'/)
  assert.match(auditMigration, /RND-AUD-/)
  assert.match(auditMigration, /audit_redact_operational_state/)
  assert.match(auditMigration, /'tecnico_telefono'/)
})

test('critical domains receive reversible metadata and audit triggers', () => {
  for (const table of reversibleTables) {
    assert.match(auditMigration, new RegExp(`alter table public\\.${table}`))
    assert.match(auditMigration, new RegExp(`'${table}'`))
    assert.match(compatibilityMigration, new RegExp(`'${table}'`))
  }
  for (const field of ['deleted_at', 'deleted_by_user_id', 'delete_operation_id', 'restored_at', 'restored_by_user_id', 'restore_operation_id']) {
    assert.match(auditMigration, new RegExp(field))
  }
})

test('legacy authorized deletes are converted to soft delete instead of losing rows', () => {
  assert.match(compatibilityMigration, /create or replace function public\.convert_operational_delete_to_soft_delete/)
  assert.match(compatibilityMigration, /before delete/)
  assert.match(compatibilityMigration, /return null/)
  assert.match(compatibilityMigration, /deleted_at=coalesce\(deleted_at,now\(\)\)/)
})

test('ordinary reads and updates exclude deleted rows', () => {
  assert.match(compatibilityMigration, /deleted_at is null/)
  assert.match(compatibilityMigration, /alter policy segnalazioni_permission_select/)
  assert.match(compatibilityMigration, /alter policy interventi_permission_select/)
  assert.match(compatibilityMigration, /alter policy planning_lavori_permission_select/)
  assert.match(compatibilityMigration, /alter policy planning_lavori_giorni_permission_select/)
})

test('restore RPCs preserve the existing domain permission model', () => {
  assert.match(auditMigration, /create or replace function public\.restore_issue/)
  assert.match(auditMigration, /created_by_user_id=v_uid and public\.is_hotel_member/)
  assert.match(auditMigration, /create or replace function public\.restore_planning_work_day/)
  assert.match(auditMigration, /public\.has_app_permission\(p_hotel_id,'planning_work','delete'\)/)
  assert.match(auditMigration, /create or replace function public\.restore_intervention/)
  assert.match(auditMigration, /public\.has_app_permission\(p_hotel_id,'interventions','delete'\)/)
  assert.match(auditMigration, /p_operation_id !~ '\^RND-OP-'/)
})
