import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildHealthEvidenceSnapshot } from '../src/randai/core/health-evidence.js'
import { evaluateRandCoreFullHealthGate } from '../src/randai/core/full-health-gate.js'

const now='2026-09-03T20:00:00.000Z'
const sha='abc123'
const healthyDomains={
  database:{status:'HEALTHY',score:100,checkedAt:now,source:'supabase-runtime',evidence:{rls_disabled_tables:0}},
  security:{status:'HEALTHY',score:100,checkedAt:now,source:'supabase-runtime',evidence:{anon_security_definer_executable:0}},
  workers:{status:'HEALTHY',score:100,checkedAt:now,source:'supabase-runtime',evidence:{active_jobs:6}},
  deploy:{status:'HEALTHY',score:100,checkedAt:now,source:'github-actions-main',evidence:{commit_sha:sha}},
  dependencies:{status:'HEALTHY',score:100,checkedAt:now,source:'npm-audit-main',evidence:{commit_sha:sha}},
  integrations:{status:'HEALTHY',score:100,checkedAt:now,source:'randcore-operational-integration-probe',evidence:{probe:'operational-trace'}},
  backup_restore:{status:'HEALTHY',score:100,checkedAt:now,source:'randcore-isolated-logical-restore-drill',evidence:{restore_verified:true,isolated:true,production_mutated:false,scope:'critical-non-secret-control-plane'}},
}

test('73: full gate passes only with seven fresh healthy proofs',()=>{
  const snapshot=buildHealthEvidenceSnapshot({generatedAt:now,domains:healthyDomains})
  const gate=evaluateRandCoreFullHealthGate(snapshot,{expectedCommitSha:sha})
  assert.equal(snapshot.coverage.verified_domains,7)
  assert.equal(snapshot.status,'HEALTHY')
  assert.equal(snapshot.score,100)
  assert.equal(snapshot.confidence,100)
  assert.equal(gate.passed,true)
  assert.equal(gate.status,'FULL_HEALTHY')
})

test('73: stale or mismatched proof blocks full health',()=>{
  const snapshot=buildHealthEvidenceSnapshot({generatedAt:now,domains:{...healthyDomains,deploy:{...healthyDomains.deploy,evidence:{commit_sha:'old'}}}})
  const gate=evaluateRandCoreFullHealthGate(snapshot,{expectedCommitSha:sha})
  assert.equal(gate.passed,false)
  assert.ok(gate.reasons.includes('deploy:commit-mismatch'))
})

test('73: backup domain requires an isolated verified restore, not backup existence',()=>{
  const snapshot=buildHealthEvidenceSnapshot({generatedAt:now,domains:{...healthyDomains,backup_restore:{...healthyDomains.backup_restore,evidence:{restore_verified:false,isolated:true,production_mutated:false}}}})
  const gate=evaluateRandCoreFullHealthGate(snapshot,{expectedCommitSha:sha})
  assert.equal(gate.passed,false)
  assert.ok(gate.reasons.includes('backup_restore:restore-not-verified'))
})

test('73: migration uses real traces, temp restore and service-only helpers',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260903201000_randcore_full_health_final_gate.sql',import.meta.url),'utf8')
  assert.match(sql,/randcore_measure_integrations_internal/)
  assert.match(sql,/weather_alert_state/)
  assert.match(sql,/sensori_temperatura/)
  assert.match(sql,/whatsapp_channel_settings/)
  assert.match(sql,/randcore_run_recoverability_drill_internal/)
  assert.match(sql,/create temporary table rc73_settings_live/i)
  assert.match(sql,/production_mutated',false/)
  assert.match(sql,/managed_pitr_certified',false/)
  assert.match(sql,/revoke all on function public\.randcore_measure_integrations_internal\(\) from public, anon, authenticated/)
  assert.match(sql,/timeout_milliseconds := 20000/)
})

test('73: weather worker has bounded retries and exposes partial failure',()=>{
  const worker=fs.readFileSync(new URL('../supabase/functions/weather-alert-worker/index.ts',import.meta.url),'utf8')
  assert.match(worker,/attempt<=3/)
  assert.match(worker,/AbortController/)
  assert.match(worker,/summary\.every/)
  assert.match(worker,/reason/)
})

test('73: RandControl exposes the final gate instead of inferring it from score alone',()=>{
  const ui=fs.readFileSync(new URL('../src/randai/control/RandCoreHealthConsole.jsx',import.meta.url),'utf8')
  assert.match(ui,/evaluateRandCoreFullHealthGate/)
  assert.match(ui,/FULL_HEALTHY/)
  assert.match(ui,/7\/7/)
})
