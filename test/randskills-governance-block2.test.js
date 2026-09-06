import test from 'node:test'
import assert from 'node:assert/strict'
import { SkillRegistry } from '../src/randai/skills/registry.js'
import { SkillRisk, SkillStatus } from '../src/randai/skills/contracts.js'
import { RandSkillGovernance, SkillGovernanceAction, assessSkillLifecycle } from '../src/randai/skills/governance.js'

function makeRegistry() {
  const registry = new SkillRegistry()
  registry.register({ id: 'low-skill', version: '1.0.0', name: 'Low', description: 'low risk tested skill', risk: SkillRisk.LOW, status: SkillStatus.TESTED, tags: ['ops'], requiredTools: ['ops.read'], metadata: { routing: { keywords: ['alpha'] } } })
  registry.register({ id: 'high-skill', version: '1.0.0', name: 'High', description: 'high risk tested skill', risk: SkillRisk.HIGH, status: SkillStatus.TESTED, tags: ['ops'], requiredTools: ['ops.write'], metadata: { routing: { keywords: ['beta'] } } })
  registry.register({ id: 'legacy-skill', version: '1.0.0', name: 'Legacy', description: 'retired skill', risk: SkillRisk.LOW, status: SkillStatus.DEPRECATED, tags: ['legacy'], requiredTools: ['legacy.read'] })
  return registry
}

test('block2: low risk tested skill can become auto-approve eligible only with verified evidence', () => {
  const registry = makeRegistry()
  const skill = registry.inspect('low-skill')
  assert.equal(assessSkillLifecycle(skill, { verifiedEvidenceCount: 1 }).action, SkillGovernanceAction.KEEP)
  assert.equal(assessSkillLifecycle(skill, { verifiedEvidenceCount: 2 }).action, SkillGovernanceAction.AUTO_APPROVE_ELIGIBLE)
})

test('block2: high risk or boundary-changing skill always requires review', () => {
  const registry = makeRegistry()
  assert.equal(assessSkillLifecycle(registry.inspect('high-skill'), { verifiedEvidenceCount: 3 }).action, SkillGovernanceAction.REVIEW_REQUIRED)
  assert.equal(assessSkillLifecycle(registry.inspect('low-skill'), { verifiedEvidenceCount: 3, changesAuthorization: true }).action, SkillGovernanceAction.REVIEW_REQUIRED)
})

test('block2: approved but unused skill is review-only, never an automatic zombie', () => {
  const registry = new SkillRegistry()
  registry.register({ id: 'approved', version: '1.0.0', name: 'Approved', description: 'approved skill', status: SkillStatus.APPROVED })
  const assessment = assessSkillLifecycle(registry.inspect('approved'), { usageCount: 0 }, { now: new Date('2026-09-06T00:00:00Z') })
  assert.equal(assessment.action, SkillGovernanceAction.REVIEW_REQUIRED)
  assert.equal(assessment.reason, 'APPROVED_SKILL_STALE_REVIEW_ONLY')
})

test('block2: zombie requires retired state, zero use, zero references and explicit replacement', () => {
  const registry = makeRegistry()
  const legacy = registry.inspect('legacy-skill')
  assert.equal(assessSkillLifecycle(legacy, { usageCount: 0, referenceCount: 0 }).action, SkillGovernanceAction.DEPRECATION_REVIEW)
  assert.equal(assessSkillLifecycle(legacy, { usageCount: 0, referenceCount: 0, replacementSkillId: 'low-skill' }).action, SkillGovernanceAction.ZOMBIE_CANDIDATE)
  assert.equal(assessSkillLifecycle(legacy, { usageCount: 0, referenceCount: 1, replacementSkillId: 'low-skill' }).action, SkillGovernanceAction.DEPRECATION_REVIEW)
})

test('block2: autoApprove performs only the existing legal TESTED -> APPROVED transition', () => {
  const registry = makeRegistry()
  const governance = new RandSkillGovernance({ skillRegistry: registry })
  const result = governance.autoApprove({ id: 'low-skill', telemetry: { verifiedEvidenceCount: 2 } })
  assert.equal(result.skill.status, SkillStatus.APPROVED)
  assert.throws(() => governance.autoApprove({ id: 'high-skill', telemetry: { verifiedEvidenceCount: 4 } }), /not eligible/)
})

test('block2: snapshot exposes review and zombie counts without mutating registry', () => {
  const registry = makeRegistry()
  const governance = new RandSkillGovernance({ skillRegistry: registry })
  const snapshot = governance.snapshot({ telemetry: {
    'low-skill': { verifiedEvidenceCount: 2 },
    'high-skill': { verifiedEvidenceCount: 3 },
    'legacy-skill': { replacementSkillId: 'low-skill' },
  }, now: new Date('2026-09-06T00:00:00Z') })
  assert.equal(snapshot.summary.total, 3)
  assert.equal(snapshot.summary.autoApproveEligible, 1)
  assert.equal(snapshot.summary.reviewRequired, 1)
  assert.equal(snapshot.summary.zombieCandidates, 1)
  assert.equal(registry.inspect('low-skill').status, SkillStatus.TESTED)
})

test('block2: semantic overlap is surfaced for review, never auto-merged', () => {
  const registry = new SkillRegistry()
  for (const id of ['one', 'two']) registry.register({ id, version: '1.0.0', name: id, description: `${id} duplicated scope`, status: SkillStatus.APPROVED, tags: ['same','ops'], requiredTools: ['same.*'], metadata: { routing: { keywords: ['same','duplicate'] } } })
  const snapshot = new RandSkillGovernance({ skillRegistry: registry }).snapshot({ telemetry: { one: { usageCount: 1 }, two: { usageCount: 1 } } })
  assert.equal(snapshot.overlaps.length, 1)
  assert.deepEqual(snapshot.overlaps[0].skillIds, ['one','two'])
  assert.equal(snapshot.overlaps[0].action, SkillGovernanceAction.REVIEW_REQUIRED)
})
