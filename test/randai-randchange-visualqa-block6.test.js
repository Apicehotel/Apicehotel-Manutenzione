import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuditRecord, AuditOutcome } from '../src/reliability/audit-reversible.js'
import { evaluateVisualQa, VisualQaStatus, createRandChangeReceipt, ChangeReceiptStatus, assertCertifiedChangeReceipt } from '../src/randai/change/index.js'

const visual = (fingerprint, hotelId = 'hotelgio') => ({
  manifest: {
    hotelId,
    diagramType: 'architecture',
    fingerprint,
    sourceIds: ['health:database', 'commit:abc1234'],
    width: 800,
    height: 600,
  },
})

const browserEvidence = [
  { engine: 'chromium', status: 'PASS', evidenceId: 'artifact-chromium-1' },
  { engine: 'webkit', status: 'PASS', evidenceId: 'artifact-webkit-1' },
]

test('visual QA certifies an expected change only with Chromium and WebKit evidence', () => {
  const result = evaluateVisualQa({ before: visual('before'), after: visual('after'), expectedChange: true, renderEvidence: browserEvidence })
  assert.equal(result.status, VisualQaStatus.PASS)
  assert.equal(result.changed, true)
})

test('visual QA blocks missing browser evidence', () => {
  const result = evaluateVisualQa({ before: visual('before'), after: visual('after'), renderEvidence: [{ engine: 'chromium', status: 'PASS', evidenceId: 'c1' }] })
  assert.equal(result.status, VisualQaStatus.BLOCKED)
  assert.ok(result.reasons.includes('MISSING_WEBKIT_EVIDENCE'))
})

test('visual QA blocks an unexpected visual drift', () => {
  const result = evaluateVisualQa({ before: visual('before'), after: visual('after'), expectedChange: false, renderEvidence: browserEvidence })
  assert.equal(result.status, VisualQaStatus.BLOCKED)
  assert.ok(result.reasons.includes('UNEXPECTED_VISUAL_CHANGE_DETECTED'))
})

test('visual QA rejects cross-hotel before/after artifacts', () => {
  assert.throws(() => evaluateVisualQa({ before: visual('a', 'hotelgio'), after: visual('b', 'chocohotel'), renderEvidence: browserEvidence }), /VISUAL_QA_SCOPE_MISMATCH/)
})

test('code change receipt becomes CERTIFIED with full evidence and rollback', () => {
  const qa = evaluateVisualQa({ before: visual('a'), after: visual('b'), renderEvidence: browserEvidence })
  const receipt = createRandChangeReceipt({
    id: 'change-1', kind: 'CODE', hotelId: 'hotelgio', actorId: 'randagent',
    beforeCommit: { sha: 'abcdef1' }, afterCommit: { sha: 'abcdef2' },
    files: [{ path: 'src/randai/change/receipt.js', status: 'ADDED' }],
    dependencies: [],
    tests: [{ name: 'block6', status: 'PASS', evidenceId: 'ci:test:block6' }],
    gates: [{ name: 'CI', status: 'PASS', evidenceId: 'ci:run:1' }],
    visuals: [qa],
    rollback: { available: true, strategy: 'git-revert', reference: 'abcdef1', verified: true },
    sourceIds: ['pr:176', 'ci:run:1'],
  })
  assert.equal(receipt.status, ChangeReceiptStatus.CERTIFIED)
  assert.equal(assertCertifiedChangeReceipt(receipt), receipt)
})

test('receipt is fail-closed on unknown or failed evidence', () => {
  const receipt = createRandChangeReceipt({
    id: 'change-2', kind: 'CODE', hotelId: 'hotelgio', actorId: 'randagent',
    beforeCommit: 'abcdef1', afterCommit: 'abcdef2',
    tests: [{ name: 'unit', status: 'UNKNOWN' }],
    gates: [{ name: 'CI', status: 'PASS', evidenceId: 'ci:2' }],
    rollback: { available: false }, sourceIds: ['ci:2'],
  })
  assert.equal(receipt.status, ChangeReceiptStatus.BLOCKED)
  assert.ok(receipt.reasons.includes('TEST_GATE_NOT_PASSING'))
})

test('mutating receipt cannot be certified without declared rollback', () => {
  const receipt = createRandChangeReceipt({
    id: 'change-3', kind: 'CODE', hotelId: 'hotelgio', actorId: 'randagent',
    beforeCommit: 'abcdef1', afterCommit: 'abcdef2',
    files: [{ path: 'x.js', status: 'MODIFIED' }],
    tests: [{ name: 'unit', status: 'PASS', evidenceId: 't1' }],
    gates: [{ name: 'CI', status: 'PASS', evidenceId: 'g1' }],
    sourceIds: ['diff:1'],
  })
  assert.ok(receipt.reasons.includes('ROLLBACK_NOT_DECLARED'))
})

test('operation receipt reuses verified audit authority', () => {
  const audit = createAuditRecord({
    operationId: 'op-1', hotelId: 'hotelgio', actorId: 'user-1', module: 'maintenance', action: 'update',
    before: { status: 'open' }, after: { status: 'done' }, outcome: AuditOutcome.SUCCEEDED, verified: true,
  })
  const receipt = createRandChangeReceipt({
    id: 'change-op-1', kind: 'OPERATION', hotelId: 'hotelgio', actorId: 'user-1', operationId: 'op-1', auditRecord: audit,
    tests: [{ name: 'verify-operation', status: 'PASS', evidenceId: 'verify:op-1' }],
    gates: [{ name: 'safe-write', status: 'PASS', evidenceId: 'gateway:op-1' }],
    rollback: { available: true, strategy: 'compensation', reference: 'audit:op-1', verified: true },
    sourceIds: ['audit:op-1', 'gateway:op-1'],
  })
  assert.equal(receipt.status, ChangeReceiptStatus.CERTIFIED)
})

test('operation receipt blocks audit scope mismatch', () => {
  const audit = createAuditRecord({ operationId: 'op-2', hotelId: 'chocohotel', actorId: 'u', module: 'm', action: 'a', outcome: AuditOutcome.SUCCEEDED, verified: true })
  const receipt = createRandChangeReceipt({
    id: 'change-op-2', kind: 'OPERATION', hotelId: 'hotelgio', actorId: 'u', operationId: 'op-2', auditRecord: audit,
    tests: [{ name: 'verify', status: 'PASS', evidenceId: 't' }], gates: [{ name: 'safe-write', status: 'PASS', evidenceId: 'g' }],
    rollback: { available: true, strategy: 'compensation', reference: 'audit:op-2' }, sourceIds: ['audit:op-2'],
  })
  assert.ok(receipt.reasons.includes('AUDIT_SCOPE_MISMATCH'))
})

test('receipt requires provenance and non-identical code commits', () => {
  const receipt = createRandChangeReceipt({
    id: 'change-4', kind: 'CODE', hotelId: 'hotelgio', actorId: 'randagent', beforeCommit: 'abcdef1', afterCommit: 'abcdef1',
    tests: [{ name: 'unit', status: 'PASS', evidenceId: 't' }], gates: [{ name: 'ci', status: 'PASS', evidenceId: 'g' }],
    rollback: { available: true, strategy: 'git-revert', reference: 'abcdef1' },
  })
  assert.ok(receipt.reasons.includes('MISSING_PROVENANCE'))
  assert.ok(receipt.reasons.includes('CODE_CHANGE_COMMITS_ARE_IDENTICAL'))
})
