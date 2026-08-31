import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OperationOutcome,
  OperationSource,
  createOperationEnvelope,
  operationLogContext,
  validateOperationEnvelope,
  withOperationOutcome,
} from '../src/reliability/operation-envelope.js'
import { OperationalTaskCoordinator, summarizeOperationalTask } from '../src/randai/runtime/operational-task.js'

test('operation envelope requires hotel, module and action', () => {
  assert.throws(() => createOperationEnvelope({ module: 'issues', action: 'create' }), /hotelId is required/)
})

test('operation envelope is immutable and keeps correlation context', () => {
  const envelope = createOperationEnvelope({
    operationId: 'RND-OP-test-001',
    correlationId: 'corr-123',
    traceId: 'trace-456',
    hotelId: 'hotelgio',
    userId: 'user-1',
    role: 'maintenance',
    module: 'issues',
    action: 'resolve',
    recordType: 'issue',
    recordId: '42',
    source: OperationSource.USER,
    createdAt: '2026-08-31T20:00:00.000Z',
  })

  assert.equal(validateOperationEnvelope(envelope), true)
  assert.equal(envelope.hotelId, 'hotelgio')
  assert.equal(envelope.actor.userId, 'user-1')
  assert.equal(Object.isFrozen(envelope), true)
  assert.equal(Object.isFrozen(envelope.actor), true)
  assert.deepEqual(operationLogContext(envelope), {
    operationId: 'RND-OP-test-001',
    correlationId: 'corr-123',
    traceId: 'trace-456',
    hotelId: 'hotelgio',
    module: 'issues',
    action: 'resolve',
    recordType: 'issue',
    recordId: '42',
    source: 'user',
  })
})

test('operation outcome is linked to the originating operation', () => {
  const envelope = createOperationEnvelope({
    operationId: 'RND-OP-test-002',
    hotelId: 'choco',
    module: 'planning',
    action: 'save',
    createdAt: '2026-08-31T20:00:00.000Z',
  })
  const outcome = withOperationOutcome(envelope, OperationOutcome.SUCCEEDED, { verified: true })
  assert.equal(outcome.operationId, envelope.operationId)
  assert.equal(outcome.outcome, 'succeeded')
  assert.equal(outcome.details.verified, true)
})

test('issue coordinator attaches one operation envelope to a new RandAI task', async () => {
  let captured = null
  const runner = {
    async create(input) {
      captured = input
      return {
        id: 'RND-RUN-1',
        metadata: input.metadata,
        plan: { steps: [] },
        steps: {},
        status: 'PENDING',
        errors: [],
      }
    },
  }
  const store = {
    async findActiveBySource() { return null },
  }
  const coordinator = new OperationalTaskCoordinator({ runner, store })
  const { task } = await coordinator.createOrReuseIssueTask({
    hotelId: 'hotelgio',
    issue: { id: 42, room: '1114', title: 'Lampada non funziona' },
    context: { userId: 'user-1', role: 'maintenance', correlationId: 'corr-42' },
  })

  assert.equal(captured.metadata.operation.hotelId, 'hotelgio')
  assert.equal(captured.metadata.operation.record.id, '42')
  assert.equal(captured.metadata.operation.actor.userId, 'user-1')
  assert.equal(captured.metadata.operation.correlationId, 'corr-42')
  assert.match(captured.metadata.operation.operationId, /^RND-OP-/)
  assert.equal(summarizeOperationalTask(task).operationId, captured.metadata.operation.operationId)
})
