import test from 'node:test'
import assert from 'node:assert/strict'
import { SoftwareEngineeringAgent, SoftwareRunStatus, assessSoftwareReadiness } from '../src/randai/software/index.js'

const plan = {
  id: 'change-1',
  steps: [{
    id: 'edit',
    title: 'edit source',
    permission: 'WRITE',
    risk: 'MEDIUM',
    strategies: [{ toolId: 'fs.edit', input: { path: 'src/example.js' } }],
  }],
}

test('software readiness requires explicit tool and permission context', () => {
  const spec = { objective: 'fix issue', projectId: 'randai', targetNodeIds: ['file:example'], proposedPlan: plan, metadata: { hotelId: 'hotelgio' } }
  const missing = assessSoftwareReadiness({ spec })
  assert.equal(missing.ok, false)
  assert.deepEqual(missing.issues.map((item) => item.code), ['TOOL_INVENTORY_MISSING', 'PERMISSION_CONTEXT_MISSING'])

  const ready = assessSoftwareReadiness({ spec, availableTools: ['fs.edit'], permissions: ['WRITE'] })
  assert.equal(ready.ok, true)
  assert.equal(ready.reviewRequired, false)
})

test('software agent stops before durable execution when readiness fails', async () => {
  let executed = false
  const agent = new SoftwareEngineeringAgent({
    projectIntelligence: { impact: async () => ({ affected: [] }) },
    durableRunner: {
      create: async () => { executed = true; return { id: 'unexpected' } },
      resume: async () => ({ status: 'SUCCEEDED' }),
    },
  })
  const prepared = await agent.prepare({
    objective: 'unsafe change',
    targetNodeIds: ['file:example'],
    proposedPlan: plan,
    availableTools: ['missing.tool'],
    permissions: ['WRITE'],
  })
  assert.equal(prepared.status, SoftwareRunStatus.READY_FOR_REVIEW)
  assert.equal(prepared.readiness.ok, false)
  const result = await agent.execute(prepared, { readiness: prepared.readiness })
  assert.equal(result.status, SoftwareRunStatus.BLOCKED)
  assert.equal(executed, false)
})

test('software readiness preserves hotel scope and flags protected risk for review', () => {
  const spec = {
    objective: 'protected change',
    projectId: 'randai',
    targetNodeIds: ['file:example'],
    proposedPlan: { ...plan, steps: [{ ...plan.steps[0], permission: 'WRITE_PROTECTED', risk: 'HIGH' }] },
    metadata: { hotelId: 'chocohotel' },
  }
  const result = assessSoftwareReadiness({ spec, availableTools: ['fs.edit'], permissions: ['WRITE_PROTECTED'] })
  assert.equal(result.ok, true)
  assert.equal(result.reviewRequired, true)
  assert.equal(result.highestRisk, 'HIGH')
})
