import test from 'node:test'
import assert from 'node:assert/strict'
import {
  interventionPreviewMetrics,
  issuePreviewMetrics,
  myWorkPreviewMetrics,
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
  assert.equal(myWorkPreviewMetrics({
    pending: [1, 2],
    inProgress: [1],
    doneToday: [1, 2, 3],
  })[2].value, 3)
})
