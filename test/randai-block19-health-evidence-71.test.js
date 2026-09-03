import assert from 'node:assert/strict'
import test from 'node:test'
import { RANDCORE_HEALTH_DOMAINS, buildHealthEvidenceSnapshot, coerceHealthEvidenceSnapshot, mergeHealthEvidenceSnapshots } from '../src/randai/core/health-evidence.js'

const now = '2026-09-03T12:00:00.000Z'
const fresh = (source = 'test') => ({ status:'HEALTHY', score:100, checkedAt:now, source, evidence:{ok:true}, confidence:100 })

test('71 canonical domains', () => {
  assert.deepEqual(RANDCORE_HEALTH_DOMAINS, ['database','security','workers','deploy','backup_restore','integrations','dependencies'])
})

test('71 incomplete evidence is not healthy', () => {
  const snapshot = buildHealthEvidenceSnapshot({ generatedAt:now, domains:{ database:fresh(), security:fresh(), workers:fresh() } })
  assert.equal(snapshot.score, 100)
  assert.equal(snapshot.status, 'DEGRADED')
  assert.equal(snapshot.coverage.evaluated_domains, 7)
  assert.equal(snapshot.coverage.verified_domains, 3)
  assert.equal(snapshot.coverage.unknown_domains, 4)
  assert.equal(snapshot.confidence, 43)
})

test('71 stale evidence is excluded from verified coverage', () => {
  const snapshot = buildHealthEvidenceSnapshot({ generatedAt:now, domains:{ database:{...fresh(),checkedAt:'2026-07-01T00:00:00.000Z'}, security:fresh() } })
  assert.equal(snapshot.domains.database.state, 'STALE')
  assert.equal(snapshot.domains.database.status, 'UNKNOWN')
  assert.equal(snapshot.coverage.stale_domains, 1)
  assert.equal(snapshot.coverage.verified_domains, 1)
})

test('71 all seven verified domains are required for healthy', () => {
  const domains = Object.fromEntries(RANDCORE_HEALTH_DOMAINS.map((domain) => [domain, fresh(`test:${domain}`)]))
  const snapshot = buildHealthEvidenceSnapshot({ generatedAt:now, domains })
  assert.equal(snapshot.status, 'HEALTHY')
  assert.equal(snapshot.score, 100)
  assert.equal(snapshot.confidence, 100)
  assert.equal(snapshot.coverage.verified_domains, 7)
})

test('71 legacy 3 of 7 remains 3 of 7', () => {
  const snapshot = coerceHealthEvidenceSnapshot({ version:1, domains:{ database:{state:'MEASURED'}, security:{state:'MEASURED'}, workers:{state:'MEASURED'}, deploy:{state:'UNKNOWN'}, backup_restore:{state:'UNKNOWN'}, integrations:{state:'UNKNOWN'}, dependencies:{state:'UNKNOWN'} } }, { generatedAt:now })
  assert.equal(snapshot.coverage.verified_domains, 3)
  assert.equal(snapshot.status, 'DEGRADED')
})

test('71 snapshots merge evidence by canonical domain', () => {
  const runtime = buildHealthEvidenceSnapshot({ generatedAt:now, domains:{ database:fresh(), security:fresh(), workers:fresh() } })
  const ci = buildHealthEvidenceSnapshot({ generatedAt:now, domains:{ deploy:fresh(), dependencies:fresh() } })
  const merged = mergeHealthEvidenceSnapshots([runtime, ci], { generatedAt:now })
  assert.equal(merged.coverage.verified_domains, 5)
  assert.equal(merged.domains.deploy.state, 'VERIFIED')
  assert.equal(merged.domains.backup_restore.state, 'UNKNOWN')
  assert.equal(merged.status, 'DEGRADED')
})
