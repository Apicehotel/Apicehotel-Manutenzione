import test from 'node:test'
import assert from 'node:assert/strict'
import {
  interventionPreviewMetrics,
  interventionTopPreview,
  issuePreviewMetrics,
  issueTopPreview,
  reminderPreviewMetrics,
  urgentPreviewMetrics,
} from '../src/randapp/operations/hub-preview-stats.js'

const dayMs = (hours = 12) => {
  const d = new Date()
  d.setHours(hours, 0, 0, 0)
  return d.getTime()
}

test('issue preview metrics count open, urgent and closed today', () => {
  const metrics = issuePreviewMetrics([
    { id: 1, status: 'todo', urgency: 'alta' },
    { id: 2, status: 'waiting', urgency: 'media' },
    { id: 3, status: 'done', urgency: 'alta', completedAt: dayMs() },
    { id: 4, status: 'done', urgency: 'bassa', completedAt: dayMs() - 3 * 86400000 },
  ])
  assert.deepEqual(metrics.map((m) => [m.label, m.value]), [
    ['Aperte', 2],
    ['Urgenti', 1],
    ['Chiuse oggi', 1],
  ])
})

test('intervention preview metrics use today / finish / done today', () => {
  const metrics = interventionPreviewMetrics([
    { id: 1, status: 'todo', scheduledAt: dayMs() },
    { id: 2, status: 'da_finire', scheduledAt: dayMs() - 86400000 },
    { id: 3, status: 'done', scheduledAt: dayMs(), completedAt: dayMs() },
  ], dayMs())
  assert.equal(metrics[0].label, 'Oggi')
  assert.equal(metrics[0].value, 1)
  assert.equal(metrics[1].label, 'Da finire')
  assert.equal(metrics[1].value, 1)
  assert.equal(metrics[2].label, 'Fatti oggi')
  assert.equal(metrics[2].value, 1)
})

test('urgent and reminder preview metrics stay compact', () => {
  assert.equal(urgentPreviewMetrics([
    { status: 'aperta' },
    { status: 'presa_in_carico' },
    { status: 'completata', completedAt: dayMs() },
  ])[0].value, 1)
  assert.equal(reminderPreviewMetrics(
    [{ active: true }, { active: false }, { active: true }],
    [{ id: 'due' }],
  )[0].value, 1)
})


test('operations top previews cap at 3 and respect operational priority', () => {
  const issues = issueTopPreview([
    { id: 1, status: 'todo', urgency: 'media', createdAt: 100 },
    { id: 2, status: 'todo', urgency: 'alta', createdAt: 50 },
    { id: 3, status: 'todo', urgency: 'alta', createdAt: 150 },
    { id: 4, status: 'todo', urgency: 'bassa', createdAt: 200 },
    { id: 5, status: 'done', urgency: 'alta', createdAt: 300 },
  ])
  assert.deepEqual(issues.map((item) => item.id), [3, 2, 4])

  const interventions = interventionTopPreview([
    { id: 'a', status: 'todo', scheduledAt: 300 },
    { id: 'b', status: 'da_finire', scheduledAt: 500 },
    { id: 'c', status: 'waiting', scheduledAt: 600 },
    { id: 'd', status: 'todo', scheduledAt: 100 },
    { id: 'e', status: 'done', scheduledAt: 10 },
  ])
  assert.deepEqual(interventions.map((item) => item.id), ['b', 'c', 'd'])
})
