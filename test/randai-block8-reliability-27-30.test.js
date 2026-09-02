import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ActionGateway,
  createOperationalContext,
  evaluateContextScope,
  validationResult,
} from '../src/reliability/index.js'

test('27 operational context is fail-closed and hotel scoped', () => {
  assert.throws(() => createOperationalContext({}), /exactly one scope/)
  assert.throws(() => createOperationalContext({ hotelId: 'hotelgio' }), /actor.userId/)
  assert.throws(() => createOperationalContext({
    hotelId: 'hotelgio', actor: { userId: 'u1' }, resource: { type: 'issue', id: 'x', hotelId: 'chocohotel' },
  }), /resource hotel scope/)
  const context = createOperationalContext({ hotelId: 'hotelgio', actor: { userId: 'u1' }, permissions: ['issues.write'] })
  assert.equal(context.hotelId, 'hotelgio')
  assert.deepEqual(context.permissions, ['issues.write'])
})

test('28 scope guard blocks cross-hotel records', () => {
  const result = evaluateContextScope({
    expected: { hotelId: 'hotelgio', module: 'issues' },
    context: { hotelId: 'hotelgio', actor: { userId: 'u1' }, screen: { view: 'issues' } },
    record: { id: '1', hotel_id: 'chocohotel' },
    permissionAllowed: true,
  })
  assert.equal(result.ok, false)
  assert.ok(result.reasons.some((item) => item.reason === 'HOTEL_MISMATCH'))
})

test('29 validation cannot be bypassed by action gateway', async () => {
  let writes = 0
  const gateway = new ActionGateway({ authorize: async () => true })
  const context = createOperationalContext({ hotelId: 'hotelgio', actor: { userId: 'u1' }, screen: { view: 'issues' } })
  await assert.rejects(() => gateway.execute({
    context, operation: 'issue.update', module: 'issues', action: 'update', permission: 'issues.write',
    validation: validationResult([{ path: 'title', code: 'REQUIRED', message: 'required' }]),
    write: async () => { writes += 1 }, readBack: async () => ({ id: '1' }),
  }), /Action Gateway/)
  assert.equal(writes, 0)
})

test('30 action gateway authorizes, verifies and emits receipt', async () => {
  const audits = []
  let persisted = null
  const gateway = new ActionGateway({
    authorize: async ({ context }) => context.hotelId === 'hotelgio',
    audit: async (receipt) => audits.push(receipt),
  })
  const context = createOperationalContext({ hotelId: 'hotelgio', actor: { userId: 'u1' }, screen: { view: 'issues' } })
  const result = await gateway.execute({
    context, operation: 'issue.update', module: 'issues', action: 'update', permission: 'issues.write',
    record: { type: 'issue', id: '1', hotelId: 'hotelgio' },
    validation: validationResult([]),
    write: async () => { persisted = { id: '1', hotelId: 'hotelgio', status: 'done' }; return persisted },
    readBack: async () => persisted,
    verify: async (value) => value.hotelId === 'hotelgio' && value.status === 'done',
  })
  assert.equal(result.ok, true)
  assert.equal(result.receipt.hotelId, 'hotelgio')
  assert.equal(audits.length, 1)
  assert.equal(audits[0].ok, true)
})

test('30 action gateway blocks global and cross-hotel writes before mutation', async () => {
  let writes = 0
  const gateway = new ActionGateway({ authorize: async () => true })
  const globalContext = createOperationalContext({ global: true })
  await assert.rejects(() => gateway.execute({
    context: globalContext, operation: 'x', module: 'issues', action: 'update', permission: 'issues.write',
    write: async () => { writes += 1 }, readBack: async () => null,
  }), /hotel scope/)

  const context = createOperationalContext({ hotelId: 'hotelgio', actor: { userId: 'u1' }, screen: { view: 'issues' } })
  await assert.rejects(() => gateway.execute({
    context, operation: 'x', module: 'issues', action: 'update', permission: 'issues.write',
    record: { type: 'issue', id: '1', hotelId: 'chocohotel' },
    write: async () => { writes += 1 }, readBack: async () => null,
  }), /SCOPE_GUARD_BLOCKED/)
  assert.equal(writes, 0)
})
