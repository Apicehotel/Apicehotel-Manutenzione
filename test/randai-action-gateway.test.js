import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildIssuePatch,
  buildIssuePreview,
  getActionDefinition,
  sanitizeActionRequest,
  validateIssueTransition,
  verifyAppliedIssueAction,
} from '../supabase/functions/_shared/randai-action-policy.js'

test('action registry classifies operational writes and requires approval', () => {
  assert.deepEqual(getActionDefinition('issue.update_priority'), {
    resourceType: 'issue', module: 'issues', permission: 'edit', risk: 'MEDIUM', approvalRequired: true,
  })
  assert.equal(getActionDefinition('issue.mark_done').risk, 'HIGH')
  assert.equal(getActionDefinition('issue.mark_done').approvalRequired, true)
  assert.equal(getActionDefinition('user.change_role'), null)
})

test('action input is allowlisted and rejects arbitrary fields or invalid priority', () => {
  const action = sanitizeActionRequest({ type: 'issue.update_priority', resource_id: 'abc', input: { priority: 'ALTA', sql: 'drop table x' } })
  assert.deepEqual(action.input, { priority: 'alta' })
  assert.equal('sql' in action.input, false)
  assert.equal(sanitizeActionRequest({ type: 'issue.update_priority', resource_id: 'abc', input: { priority: 'massima' } }), null)
  assert.equal(sanitizeActionRequest({ type: 'issue.delete', resource_id: 'abc' }), null)
})

test('mark done creates only the intended issue fields and verifies result', () => {
  const action = sanitizeActionRequest({ type: 'issue.mark_done', resource_id: 'abc', input: { completion_note: 'Filtro pulito' } })
  const patch = buildIssuePatch(action, 'Mario', '2026-08-31T01:30:00.000Z')
  assert.deepEqual(patch, {
    stato: 'done', completato_da: 'Mario', completato_il: '2026-08-31T01:30:00.000Z', nota_completamento: 'Filtro pulito',
  })
  assert.equal(verifyAppliedIssueAction({ stato: 'done', completato_il: '2026-08-31T01:30:00.000Z' }, action), true)
})

test('terminal issues cannot be re-routed to waiting part', () => {
  const action = sanitizeActionRequest({ type: 'issue.set_waiting_part', resource_id: 'abc', input: { part_name: 'Ventola' } })
  assert.deepEqual(validateIssueTransition({ stato: 'done' }, action), { ok: false, reason: 'TERMINAL_RESOURCE' })
})

test('preview preserves an optimistic concurrency version', () => {
  const action = sanitizeActionRequest({ type: 'issue.update_priority', resource_id: 'abc', input: { priority: 'alta' } })
  const preview = buildIssuePreview({ id: 'abc', hotel_id: 'hotelgio', camera: 'Camera 125', urgenza: 'media', categoria: 'Climatizzazione', stato: 'todo', updated_at: '2026-08-31T01:00:00Z' }, action, 'Mario', '2026-08-31T01:30:00Z')
  assert.equal(preview.before.updated_at, '2026-08-31T01:00:00Z')
  assert.equal(preview.after.urgenza, 'alta')
  assert.equal(preview.after.stato, 'todo')
})
