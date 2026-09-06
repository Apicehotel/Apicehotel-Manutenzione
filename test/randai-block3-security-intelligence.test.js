import test from 'node:test'
import assert from 'node:assert/strict'
import { repoRadarIntelligenceSources, RepoRadarSourceMode, RepoRadarSourceRole, assertSafeSource } from '../src/randai/discovery/source-registry.js'
import { evaluateSecurityExposure, correlateSecurityFindings, SecurityExposureLevel } from '../src/randai/core/security-intelligence.js'
import { buildSecurityAnalysisPlan } from '../src/randai/core/security-analysis-policy.js'

test('block3: curated sources are source-only or sandbox-only and never auto-install', () => {
  const sources = repoRadarIntelligenceSources()
  assert.deepEqual(sources.map((source) => source.id), ['exploitarium', 'reverse-skill', 'nosignups'])
  assert.ok(sources.every((source) => assertSafeSource(source)))
  assert.equal(sources.find((source) => source.id === 'exploitarium').role, RepoRadarSourceRole.SECURITY_INTELLIGENCE)
  assert.equal(sources.find((source) => source.id === 'reverse-skill').mode, RepoRadarSourceMode.SANDBOX_ONLY)
  assert.equal(sources.find((source) => source.id === 'nosignups').role, RepoRadarSourceRole.DISCOVERY)
})

test('block3: public exploit and production exposure increase severity', () => {
  const report = evaluateSecurityExposure({
    component: 'next', affectedVersion: '15.0.0', severity: 'MEDIUM', exploitPublic: true, productionExposed: true,
  })
  assert.equal(report.level, SecurityExposureLevel.CRITICAL)
  assert.equal(report.action, 'PATCH_OR_ISOLATE_NOW')
  assert.equal(report.automaticExploitExecution, false)
})

test('block3: inventory correlation only returns exact affected versions', () => {
  const correlated = correlateSecurityFindings([
    { component: 'vite', affectedVersion: '7.1.0', severity: 'HIGH', exploitPublic: true },
    { component: 'react', affectedVersion: '18.0.0', severity: 'HIGH', exploitPublic: true },
  ], [
    { component: 'vite', version: '7.1.0' },
    { component: 'react', version: '19.1.0' },
  ])
  assert.equal(correlated.length, 1)
  assert.equal(correlated[0].component, 'vite')
})

test('block3: reverse analysis is authorized sandbox-only', () => {
  assert.throws(() => buildSecurityAnalysisPlan({ artifactType: 'apk', authorization: false, isolated: true }), /explicit authorization/)
  assert.throws(() => buildSecurityAnalysisPlan({ artifactType: 'apk', authorization: true, isolated: false }), /sandbox-only/)
  assert.throws(() => buildSecurityAnalysisPlan({ artifactType: 'apk', authorization: true, isolated: true, production: true }), /forbidden in production/)
  const plan = buildSecurityAnalysisPlan({ artifactType: 'apk', authorization: true, isolated: true })
  assert.deepEqual(plan.stages, ['TRIAGE', 'STATIC', 'DYNAMIC', 'SYNTHESIS'])
  assert.equal(plan.networkAccess, 'DENY_BY_DEFAULT')
  assert.equal(plan.automaticExploitExecution, false)
})
