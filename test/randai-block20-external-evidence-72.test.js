import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildExternalEvidenceSnapshot, buildHealthEvidenceSnapshot, mergeHealthEvidenceSnapshots } from '../src/randai/core/health-evidence.js'

const now='2026-09-03T18:00:00.000Z'

test('72: external bridge only promotes fresh bounded evidence',()=>{
  const external=buildExternalEvidenceSnapshot([
    {id:1,domain:'deploy',status:'HEALTHY',score:100,source:'github-actions-build',checked_at:'2026-09-03T17:59:00.000Z',max_age_seconds:3600,commit_sha:'abc',evidence:{browser_gate:true}},
    {id:2,domain:'backup_restore',status:'HEALTHY',score:100,source:'restore-drill',checked_at:'2026-08-01T00:00:00.000Z',max_age_seconds:3600,evidence:{drill:true}},
    {id:3,domain:'database',status:'HEALTHY',score:100,source:'forbidden',checked_at:'2026-09-03T17:59:00.000Z',max_age_seconds:3600,evidence:{}},
  ],{generatedAt:now})
  assert.equal(external.domains.deploy.state,'VERIFIED')
  assert.equal(external.domains.backup_restore.state,'STALE')
  assert.equal(external.domains.database.state,'UNKNOWN')
})

test('72: runtime and external evidence compose without overwriting healthy runtime domains',()=>{
  const runtime=buildHealthEvidenceSnapshot({generatedAt:now,domains:{
    database:{status:'HEALTHY',score:100,checkedAt:now,source:'supabase-runtime',evidence:{rls_disabled_tables:0}},
    security:{status:'HEALTHY',score:100,checkedAt:now,source:'supabase-runtime',evidence:{anon_security_definer_executable:0}},
    workers:{status:'HEALTHY',score:100,checkedAt:now,source:'supabase-runtime',evidence:{active_jobs:6}},
  }})
  const external=buildExternalEvidenceSnapshot([
    {domain:'deploy',status:'HEALTHY',score:100,source:'github-actions-build',checked_at:now,max_age_seconds:3600,evidence:{sha:'abc'}},
    {domain:'dependencies',status:'HEALTHY',score:100,source:'npm-audit-ci',checked_at:now,max_age_seconds:3600,evidence:{audit_level:'high'}},
  ],{generatedAt:now})
  const merged=mergeHealthEvidenceSnapshots([runtime,external],{generatedAt:now})
  assert.equal(merged.coverage.verified_domains,5)
  assert.equal(merged.status,'DEGRADED')
  assert.equal(merged.domains.database.source,'supabase-runtime')
  assert.equal(merged.domains.deploy.source,'github-actions-build')
  assert.equal(merged.domains.integrations.state,'UNKNOWN')
  assert.equal(merged.domains.backup_restore.state,'UNKNOWN')
})

test('72: migration is service-only and bounded to external domains',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260903180500_randcore_external_evidence_bridge.sql',import.meta.url),'utf8')
  assert.match(sql,/randcore_external_health_evidence/)
  assert.match(sql,/service_role_required/)
  assert.match(sql,/deploy','backup_restore','integrations','dependencies/)
  assert.match(sql,/revoke all on public\.randcore_external_health_evidence from public, anon, authenticated/)
  assert.match(sql,/external_health_evidence_too_large/)
})

test('72: CI publisher keeps backup and integrations unverified unless a real source exists',()=>{
  const script=fs.readFileSync(new URL('../scripts/randcore-external-evidence.mjs',import.meta.url),'utf8')
  assert.match(script,/RANDCORE_SERVICE_ROLE_KEY/)
  assert.match(script,/domain:'deploy'/)
  assert.match(script,/domain:'dependencies'/)
  assert.doesNotMatch(script,/domain:'backup_restore'/)
  assert.doesNotMatch(script,/domain:'integrations'/)
})

test('72: RandControl consumes external evidence through the canonical merge',()=>{
  const ui=fs.readFileSync(new URL('../src/randai/control/RandCoreHealthConsole.jsx',import.meta.url),'utf8')
  assert.match(ui,/buildExternalEvidenceSnapshot/)
  assert.match(ui,/mergeHealthEvidenceSnapshots/)
  assert.match(ui,/data\?\.external_evidence/)
})
