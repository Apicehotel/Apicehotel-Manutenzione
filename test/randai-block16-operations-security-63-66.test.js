import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'
import { buildModuleHealthSnapshot } from '../src/randai/core/module-health.js'
import { buildRepoRadarSnapshot } from '../src/randai/discovery/repo-radar.js'
import { REPO_RADAR_CATALOG } from '../src/randai/discovery/repo-radar-catalog.js'

const migration=fs.readFileSync(new URL('../supabase/migrations/20260903160000_randcore_operations_security.sql',import.meta.url),'utf8')

test('module health keeps repo decision separate from installation',()=>{
  const snapshot=buildModuleHealthSnapshot({modules:getRandEcosystemManifest(),repoSnapshot:buildRepoRadarSnapshot(REPO_RADAR_CATALOG),healthCheck:{status:'HEALTHY'}})
  assert.equal(snapshot.policy.repoDecisionIsNotInstallation,true)
  assert.equal(snapshot.policy.unknownIsHealthy,false)
  assert.ok(snapshot.repoCounts.WATCH>0)
  assert.ok(snapshot.unfinished>0)
})

test('critical RandCore health dominates module projection',()=>{
  const snapshot=buildModuleHealthSnapshot({modules:getRandEcosystemManifest(),repoSnapshot:buildRepoRadarSnapshot(REPO_RADAR_CATALOG),healthCheck:{status:'CRITICAL'}})
  assert.equal(snapshot.state,'CRITICAL')
  assert.ok(snapshot.blockers.includes('CORE_HEALTH_CRITICAL'))
})

test('worker registry preserves event-driven reminders and deliberate cadences',()=>{
  assert.match(migration,/urgent-reminder-worker-30s[^\n]+true,false,false/)
  assert.match(migration,/reminder-worker-1m[^\n]+true,false,false/)
  assert.match(migration,/presence-auto-expire-7h20[^\n]+\*\/5 \* \* \* \*/)
  assert.match(migration,/sync-sensori-temperatura-secure[^\n]+\*\/30 \* \* \* \*/)
  assert.match(migration,/weather-alert-worker-2h-daytime[^\n]+0 5,7,9,11,13,15,17,19 \* \* \*/)
})

test('security hardening is targeted and denies anon execution',()=>{
  for(const name of ['ensure_urgent_reminder_worker','inventory_guard_intervention_delete','run_urgent_reminder_tick','sync_reminder_worker_cron','sync_technician_dispatch_on_issue_close','trg_sync_reminder_worker_cron']){
    assert.match(migration,new RegExp(`revoke execute on function public\\.${name}\\([^;]*\\) from public, anon, authenticated`))
  }
  for(const name of ['technician_authorize_external','technician_manage_directory','technician_membership_role','technician_reject_external','technician_request_external','technician_set_competencies']){
    assert.match(migration,new RegExp(`revoke execute on function public\\.${name}\\([^;]*\\) from public, anon`))
  }
})

test('new control RPCs are admin-gated and anon-denied',()=>{
  for(const name of ['randcore_operations_snapshot','randcore_set_worker_active','randcore_security_snapshot','randcore_observability_cost_snapshot']){
    assert.match(migration,new RegExp(`revoke all on function public\\.${name}`))
  }
  assert.match(migration,/admin_membership_required/)
  assert.match(migration,/cost_usd/)
  assert.match(migration,/unscoped_trace_count/)
})
