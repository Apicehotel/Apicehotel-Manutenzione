import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RAND_ARCHITECTURE_CURRENT_EVIDENCE,
  RandArchitectureDecision,
  RandArchitecturePattern,
  RandArchitectureSource,
  adviseRandArchitecture,
  architectureGapSummary,
  assertRandArchitectureCatalog,
  getRandArchitecturePattern,
} from '../src/randai/architecture/index.js'

test('RandArchitecture source remains reference-only and non-runtime', () => {
  assert.equal(assertRandArchitectureCatalog(), true)
  assert.equal(RandArchitectureSource.role, 'SOURCE_ONLY')
  assert.equal(RandArchitectureSource.runtimeDependency, false)
  assert.equal(RandArchitectureSource.remoteExecution, false)
  assert.equal(RandArchitectureSource.copySourceText, false)
  assert.equal(RandArchitectureSource.extractionPolicy, 'PARAPHRASE_GENERAL_PATTERNS_ONLY')
})

test('advisor keeps already implemented reliability patterns instead of duplicating them', () => {
  const advice = adviseRandArchitecture({
    domain: 'offline replay',
    requirements: ['retry', 'concurrent edit'],
  })

  const byId = new Map(advice.recommendations.map((item) => [item.id, item]))
  assert.equal(byId.get(RandArchitecturePattern.IDEMPOTENCY)?.decision, RandArchitectureDecision.KEEP)
  assert.equal(byId.get(RandArchitecturePattern.OPTIMISTIC_CONCURRENCY)?.decision, RandArchitectureDecision.KEEP)
  assert.equal(byId.get(RandArchitecturePattern.RETRY_WITH_JITTER)?.decision, RandArchitectureDecision.KEEP)
  assert.equal(advice.policy.noSecondCanonicalOwner, true)
  assert.equal(advice.policy.noAutomaticInfrastructureProvisioning, true)
})

test('advisor marks provider resilience patterns for evaluation, not automatic adoption', () => {
  const advice = adviseRandArchitecture({
    domain: 'external provider',
    requirements: ['provider quota', 'repeated failure', 'notification fatigue'],
  })

  const circuit = advice.recommendations.find((item) => item.id === RandArchitecturePattern.CIRCUIT_BREAKER)
  const rate = advice.recommendations.find((item) => item.id === RandArchitecturePattern.RATE_LIMITING)

  assert.equal(circuit?.decision, RandArchitectureDecision.EVALUATE)
  assert.equal(rate?.decision, RandArchitectureDecision.EVALUATE)
  assert.equal(architectureGapSummary(advice).add, 0)
})

test('current evidence never claims exactly-once and keeps cache non-authoritative', () => {
  assert.equal(
    getRandArchitecturePattern(RandArchitecturePattern.IDEMPOTENCY).avoidClaims.includes('exactly-once delivery'),
    true,
  )
  assert.equal(
    getRandArchitecturePattern(RandArchitecturePattern.CACHE).avoidClaims.includes('cache as source of truth'),
    true,
  )
  assert.equal(RAND_ARCHITECTURE_CURRENT_EVIDENCE[RandArchitecturePattern.CACHE].status, 'IMPLEMENTED')
})
