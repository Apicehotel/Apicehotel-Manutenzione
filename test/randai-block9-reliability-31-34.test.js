import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AuthorizationExpectation,
  AmbiguousWriteDecision,
  AuditOutcome,
  assertAuthorizationMatrix,
  assertExpectedRevision,
  commitStagedImport,
  createAuditRecord,
  createAuthorizationCase,
  createCompensationRequest,
  createIdempotencyIdentity,
  executeCompensation,
  reconcileAmbiguousWrite,
  stageImport,
  validateOutboxOperation,
  verifyAuthorizationMatrix,
} from '../src/reliability/index.js'

test('31 authorization matrix verifies allow/deny without becoming the authority', async () => {
  const cases = [
    createAuthorizationCase({ id: 'gio-own', hotelId: 'hotelgio', actorRole: 'manutentore', module: 'issues', action: 'update', expected: AuthorizationExpectation.ALLOW }),
    createAuthorizationCase({ id: 'gio-cross', hotelId: 'hotelgio', targetHotelId: 'chocohotel', actorRole: 'manutentore', module: 'issues', action: 'update', expected: AuthorizationExpectation.DENY }),
  ]
  const result = await verifyAuthorizationMatrix(cases, async (entry) => ({ allowed: entry.hotelId === entry.targetHotelId }))
  assert.equal(result.ok, true)
  assert.equal(assertAuthorizationMatrix(result), result)
})

test('31 authorization matrix exposes an unexpected backend allow as failure', async () => {
  const cases = [createAuthorizationCase({ id: 'cross', hotelId: 'hotelgio', targetHotelId: 'chocohotel', actorRole: 'x', module: 'issues', action: 'delete', expected: 'DENY' })]
  const result = await verifyAuthorizationMatrix(cases, async () => true)
  assert.equal(result.ok, false)
  assert.throws(() => assertAuthorizationMatrix(result), /AUTHORIZATION_MATRIX_FAILED/)
})

test('32 audit compensation is explicit, authorized, conflict checked and verified', async () => {
  const original = createAuditRecord({
    operationId: 'RND-OP-1', hotelId: 'hotelgio', actorId: 'u1', module: 'issues', action: 'update',
    before: { status: 'open' }, after: { status: 'done' }, outcome: AuditOutcome.SUCCEEDED, verified: true,
  })
  const request = createCompensationRequest({ operationId: 'RND-OP-2', original, actorId: 'u2', reason: 'restore requested' })
  let current = { status: 'done' }
  const audits = []
  const result = await executeCompensation({
    request,
    authorize: async () => true,
    readCurrent: async () => current,
    writeRestore: async (value) => { current = value },
    verify: async (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected),
    audit: async (entry) => audits.push(entry),
  })
  assert.equal(result.ok, true)
  assert.deepEqual(current, { status: 'open' })
  assert.equal(audits[0].outcome, AuditOutcome.COMPENSATED)
  assert.equal(audits[0].hotelId, 'hotelgio')
})

test('33 idempotency is deterministic, hotel scoped and revision conflicts fail closed', () => {
  const a = createIdempotencyIdentity({ hotelId: 'hotelgio', module: 'issues', action: 'update', recordId: '1', payload: { b: 2, a: 1 } })
  const b = createIdempotencyIdentity({ hotelId: 'hotelgio', module: 'issues', action: 'update', recordId: '1', payload: { a: 1, b: 2 } })
  const choco = createIdempotencyIdentity({ hotelId: 'chocohotel', module: 'issues', action: 'update', recordId: '1', payload: { a: 1, b: 2 } })
  assert.equal(a, b)
  assert.notEqual(a, choco)
  assert.equal(assertExpectedRevision({ expectedRevision: 3, actualRevision: 3 }), true)
  assert.throws(() => assertExpectedRevision({ expectedRevision: 3, actualRevision: 4 }), /REVISION_CONFLICT/)
  assert.throws(() => validateOutboxOperation({ operationId: 'x', idempotencyKey: 'y', hotelId: 'chocohotel' }, { hotelId: 'hotelgio' }), /OUTBOX_HOTEL_MISMATCH/)
})

test('33 ambiguous writes reconcile before retrying', async () => {
  const replay = await reconcileAmbiguousWrite({
    idempotencyKey: 'k', findReceipt: async () => ({ ok: true }), readBack: async () => null, matchesExpected: async () => false,
  })
  assert.equal(replay.decision, AmbiguousWriteDecision.REPLAY_RECEIPT)

  const confirmed = await reconcileAmbiguousWrite({
    idempotencyKey: 'k2', findReceipt: async () => null, readBack: async () => ({ status: 'done' }), matchesExpected: async (value) => value.status === 'done',
  })
  assert.equal(confirmed.decision, AmbiguousWriteDecision.CONFIRMED_APPLIED)
})

test('34 import staging rejects cross-hotel rows and prevents partial commit', async () => {
  const staged = await stageImport({
    batchId: 'batch-1', hotelId: 'hotelgio',
    rows: [{ id: '1', hotelId: 'hotelgio' }, { id: '2', hotelId: 'chocohotel' }],
    validateRow: async () => ({ ok: true }), dedupeKey: (row) => row.id,
  })
  assert.equal(staged.readyCount, 1)
  assert.equal(staged.rejectedCount, 1)
  assert.equal(staged.canCommit, false)
  await assert.rejects(() => commitStagedImport({ staged }), /IMPORT_STAGE_NOT_COMMITTABLE/)
})

test('34 import commit requires read-back verification and audit', async () => {
  const staged = await stageImport({
    batchId: 'batch-2', hotelId: 'hotelgio', rows: [{ id: '1', hotelId: 'hotelgio' }],
    validateRow: async () => ({ ok: true }), dedupeKey: (row) => row.id,
  })
  const audits = []
  let persisted = []
  const result = await commitStagedImport({
    staged,
    writeRows: async (rows) => { persisted = rows; return { count: rows.length } },
    readBack: async () => persisted,
    verify: async (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected),
    audit: async (receipt) => audits.push(receipt),
  })
  assert.equal(result.ok, true)
  assert.equal(audits.length, 1)
  assert.equal(audits[0].verified, true)
  assert.equal(audits[0].hotelId, 'hotelgio')
})
