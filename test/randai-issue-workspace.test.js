import test from 'node:test'
import assert from 'node:assert/strict'
import { issueWorkspaceProgress } from '../src/randai/issue-workspace.js'

test('issue workspace progress exposes durable task state for RandApp UI', () => {
  const value = issueWorkspaceProgress({
    status: 'PAUSED',
    completedSteps: 2,
    totalSteps: 5,
    nextStepTitle: 'Controlla il termostato',
  })
  assert.deepEqual(value, {
    completed: 2,
    total: 5,
    percent: 40,
    label: '2/5 passaggi',
    next: 'Controlla il termostato',
    status: 'PAUSED',
  })
})

test('issue workspace progress never invents progress without steps', () => {
  assert.equal(issueWorkspaceProgress(null), null)
  const value = issueWorkspaceProgress({ status: 'VERIFYING', completedSteps: 0, totalSteps: 0 })
  assert.equal(value.percent, 0)
  assert.equal(value.label, 'Percorso pronto')
  assert.equal(value.status, 'VERIFYING')
})
