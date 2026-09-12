import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const persistenceSql = fs.readFileSync(new URL('../supabase/migrations/20260912113000_randcore_runtime_v2_persistence.sql', import.meta.url), 'utf8')
const immutabilitySql = fs.readFileSync(new URL('../supabase/migrations/20260912114500_randcore_event_immutability.sql', import.meta.url), 'utf8')

test('RandCore schema persists every runtime owner and indexes claim/recovery paths', () => {
  for (const table of ['randcore_events', 'randcore_jobs', 'randcore_workers', 'randcore_dead_letters']) {
    assert.match(persistenceSql, new RegExp(`create table if not exists public\\.${table}`, 'i'))
    assert.match(persistenceSql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(persistenceSql, /randcore_jobs_lease_idx/i)
  assert.match(persistenceSql, /randcore_events_correlation_idx/i)
  assert.match(persistenceSql, /unique index[\s\S]*randcore_dead_letters_job_reason_uidx/i)
})

test('claim, renewal and recovery RPCs are service-role-only and recovery is concurrency safe', () => {
  for (const fn of ['randcore_claim_job', 'randcore_renew_job_lease', 'randcore_recover_expired_jobs']) {
    assert.match(persistenceSql, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`, 'i'))
    assert.match(persistenceSql, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*to service_role`, 'i'))
  }
  assert.match(persistenceSql, /for update skip locked/i)
  assert.match(persistenceSql, /status='RUNNING'[\s\S]*worker_id=p_worker_id/i)
  assert.match(persistenceSql, /lease_expires_at is not null[\s\S]*lease_expires_at <= p_now/i)
  assert.match(persistenceSql, /on conflict \(job_id,reason\) do nothing/i)
})

test('event provenance is immutable at database level, not only by adapter convention', () => {
  assert.match(immutabilitySql, /create trigger randcore_events_immutable/i)
  assert.match(immutabilitySql, /before update on public\.randcore_events/i)
  assert.match(immutabilitySql, /RANDCORE_EVENT_IMMUTABLE/i)
  assert.match(immutabilitySql, /new\.payload is distinct from old\.payload/i)
  assert.match(immutabilitySql, /new\.hotel_id is distinct from old\.hotel_id/i)
})
