import test from 'node:test'
import assert from 'node:assert/strict'
import { RandAISupervisor, SupervisorMode, SupervisorStopReason } from '../src/randai/supervisor/index.js'

test('supervisor preflight rejects duplicate task ids and unknown dependencies', () => {
  const supervisor = new RandAISupervisor()
  const duplicate = supervisor.plan({ objective: 'audit', agentTasks: [{ id: 'a' }, { id: 'a' }] })
  assert.equal(duplicate.mode, SupervisorMode.STOPPED)
  assert.equal(duplicate.reason, SupervisorStopReason.INVALID_TASK_GRAPH)

  const unknown = supervisor.plan({ objective: 'audit', agentTasks: [{ id: 'a', dependsOn: ['missing'] }] })
  assert.equal(unknown.mode, SupervisorMode.STOPPED)
  assert.equal(unknown.reason, SupervisorStopReason.INVALID_TASK_GRAPH)
})

test('supervisor preflight rejects dependency cycles before runtime dispatch', () => {
  const supervisor = new RandAISupervisor()
  const plan = supervisor.plan({
    objective: 'coordinate',
    agentTasks: [
      { id: 'a', dependsOn: ['b'] },
      { id: 'b', dependsOn: ['a'] },
    ],
  })
  assert.equal(plan.mode, SupervisorMode.STOPPED)
  assert.equal(plan.reason, SupervisorStopReason.INVALID_TASK_GRAPH)
})

test('supervisor still selects explicit modes for valid graphs', () => {
  const supervisor = new RandAISupervisor({ defaultBudget: { maxAgents: 2 } })
  assert.equal(supervisor.plan({ objective: 'single', agentTasks: [{ id: 'a' }] }).mode, SupervisorMode.SINGLE_AGENT)
  assert.equal(supervisor.plan({ objective: 'parallel', agentTasks: [{ id: 'a' }, { id: 'b', dependsOn: ['a'] }] }).mode, SupervisorMode.MULTI_AGENT)
})
