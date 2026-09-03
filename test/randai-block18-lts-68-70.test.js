import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { EcosystemStatus, getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'
import { buildRandLtsAttestation, evaluateRandLtsReadiness, RAND_LTS_REQUIRED_LIVE, RAND_LTS_VERSION } from '../src/randai/core/lts-readiness.js'

const manifest = getRandEcosystemManifest()
const byId = new Map(manifest.map((module) => [module.id, module]))
const checks = {
  security: true,
  quality: true,
  critical: true,
  multihotel: true,
  production: true,
  build: true,
  contracts: true,
  browser: true,
  device: true,
  warehouse: true,
  ecosystem: true,
}

test('68: final ecosystem gate requires the operational LTS modules to be LIVE with evidence', () => {
  const readiness = evaluateRandLtsReadiness({ modules: manifest })
  assert.equal(readiness.ready, true)
  assert.equal(readiness.version, '1.0')
  assert.equal(readiness.zombieCount, 0)
  for (const id of RAND_LTS_REQUIRED_LIVE) {
    assert.equal(byId.get(id)?.status, EcosystemStatus.LIVE, `${id} must be LIVE`)
    assert.ok(byId.get(id)?.evidence?.length, `${id} must expose evidence`)
  }
  assert.equal(byId.get('warehouse')?.status, EcosystemStatus.LIVE)
  assert.ok(byId.get('warehouse')?.evidence.includes('src/randai/context/warehouse-evidence.js'))
})

test('68: LTS readiness fails closed when a required module regresses', () => {
  const degraded = manifest.map((module) => module.id === 'warehouse' ? { ...module, status: EcosystemStatus.PARTIAL } : module)
  const readiness = evaluateRandLtsReadiness({ modules: degraded })
  assert.equal(readiness.ready, false)
  assert.ok(readiness.blockers.some((item) => item.code === 'REQUIRED_MODULE_NOT_LIVE' && item.moduleId === 'warehouse'))
})

test('69: no canonical zombies are hidden and compatibility shims remain single-authority aliases', () => {
  assert.equal(manifest.some((module) => module.status === EcosystemStatus.ZOMBIE), false)
  const appShim = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const housekeepingShim = fs.readFileSync(new URL('../src/housekeeping.jsx', import.meta.url), 'utf8')
  assert.match(appShim, /compatibility entry/)
  assert.match(appShim, /\.\/randapp\/App\.jsx/)
  assert.match(housekeepingShim, /housekeeping-v3\.jsx/)
  assert.doesNotMatch(housekeepingShim, /function Housekeeping|const Housekeeping|class Housekeeping/)
})

test('69: legacy issue spare-part intake is not a second stock authority', () => {
  const issues = fs.readFileSync(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
  const interventionAdapter = fs.readFileSync(new URL('../src/inventory-intervention-data.js', import.meta.url), 'utf8')
  assert.match(issues, /pieceNeeded|pieceName/)
  assert.doesNotMatch(issues, /inventory_consume_intervention_part|inventory_movements/)
  assert.match(interventionAdapter, /inventory_request_intervention_part/)
})

test('70: Rand Ecosystem LTS attestation is explicit about included and deferred modules', () => {
  const attestation = buildRandLtsAttestation({ commitSha: 'abc123', checks, modules: manifest, generatedAt: '2026-09-03T00:00:00.000Z' })
  assert.equal(attestation.schema, 'rand.ecosystem-lts-attestation.v1')
  assert.equal(attestation.release, `Rand Ecosystem LTS ${RAND_LTS_VERSION}`)
  assert.equal(attestation.zeroCanonicalZombies, true)
  assert.ok(attestation.includedModules.includes('warehouse'))
  assert.ok(attestation.includedModules.includes('randguide'))
  assert.equal(byId.get('randguide')?.status, EcosystemStatus.LIVE)
  assert.ok(byId.get('randguide')?.evidence?.length, 'RandGuide inclusion must remain evidence-backed')
  assert.ok(attestation.deferredModules.some((module) => module.id === 'randaudio' && module.status === EcosystemStatus.PLANNED))
  assert.ok(attestation.deferredModules.some((module) => module.id === 'viking' && module.status === EcosystemStatus.PLANNED))
  assert.equal(attestation.deferredModules.some((module) => module.id === 'randguide'), false)
})

test('70: attestation cannot be emitted when a final gate is missing', () => {
  assert.throws(
    () => buildRandLtsAttestation({ commitSha: 'abc123', checks: { ...checks, device: false }, modules: manifest }),
    (error) => error?.code === 'RAND_LTS_CHECK_FAILED' && error.failedChecks.includes('device'),
  )
})

test('70: CI emits a commit-bound LTS artifact only after browser and device gates', () => {
  const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const script = fs.readFileSync(new URL('../scripts/rand-lts-attestation.mjs', import.meta.url), 'utf8')
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(ci, /Rand Ecosystem LTS attestation/)
  assert.match(ci, /npm run lts:attest/)
  assert.equal(pkg.scripts?.['lts:attest'], 'node scripts/rand-lts-attestation.mjs')
  assert.match(ci, /rand-ecosystem-lts-1\.0/)
  assert.ok(ci.indexOf('Rand Ecosystem LTS attestation') > ci.indexOf('Device acceptance gate'))
  assert.match(script, /missingEvidence/)
  assert.match(script, /RAND_LTS_COMMIT_SHA|GITHUB_SHA/)
})
