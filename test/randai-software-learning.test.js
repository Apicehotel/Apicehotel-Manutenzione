import test from 'node:test'
import assert from 'node:assert/strict'
import { SoftwareEngineeringAgent, SoftwareRunStatus } from '../src/randai/software/index.js'
import { LearningEngine, LearningCandidateStatus } from '../src/randai/learning/index.js'
import { SkillRegistry } from '../src/randai/skills/registry.js'
import { SkillStatus } from '../src/randai/skills/contracts.js'
import { EvaluationEngine } from '../src/randai/evals/engine.js'

const proposedPlan = { id: 'software-fix', steps: [{ id: 'edit', title: 'edit', strategies: [{ toolId: 'fs.edit', input: { path: 'x.js' } }] }] }

test('software engineering agent requires impact analysis and verified execution', async () => {
  const calls = []
  const agent = new SoftwareEngineeringAgent({
    projectIntelligence: { impact: async (projectId, nodeId) => ({ projectId, root: nodeId, affected: ['test:x'] }) },
    durableRunner: {
      create: async ({ objective }) => ({ id: 'task-1', objective }),
      resume: async (id) => ({ id, status: 'SUCCEEDED', steps: { edit: { status: 'SUCCEEDED' } } }),
    },
    reviewer: { review: async ({ task }) => { calls.push(task.id); return { ok: true } } },
  })
  const spec = await agent.analyze({ objective: 'fix parser bug', projectId: 'randai', targetNodeIds: ['file:app'], proposedPlan })
  assert.equal(spec.impacts[0].impact.root, 'file:app')
  const result = await agent.execute(spec)
  assert.equal(result.status, SoftwareRunStatus.SUCCEEDED)
  assert.deepEqual(calls, ['task-1'])
})

test('software engineering agent never reports success when durable execution is blocked', async () => {
  let reviewed = false
  const agent = new SoftwareEngineeringAgent({
    projectIntelligence: { impact: async () => ({ affected: [] }) },
    durableRunner: {
      create: async () => ({ id: 'task-2' }),
      resume: async () => ({ id: 'task-2', status: 'BLOCKED' }),
    },
    reviewer: { review: async () => { reviewed = true; return { ok: true } } },
  })
  const spec = await agent.analyze({ objective: 'protected change', targetNodeIds: [], proposedPlan })
  const result = await agent.execute(spec)
  assert.equal(result.status, SoftwareRunStatus.BLOCKED)
  assert.equal(reviewed, false)
})

test('learning engine needs repeated verified evidence before proposing a skill', async () => {
  const learning = new LearningEngine({ minEvidence: 2 })
  const registry = new SkillRegistry()
  const base = { problemClass: 'jsx-parser', strategy: 'inspect the block immediately before the parser location, patch minimally, build and test', tools: ['repo.read', 'fs.edit', 'test.run'], verified: true }
  const first = await learning.observe({ ...base, source: { kind: 'task', id: 't1' }, metadata: { taskId: 't1' } })
  assert.equal(first.status, LearningCandidateStatus.OBSERVED)
  await assert.rejects(() => learning.proposeSkill(first.id, { skillRegistry: registry, id: 'repair-jsx-parser', name: 'Repair JSX Parser', description: 'Repair verified JSX parser failures' }))
  const second = await learning.observe({ ...base, source: { kind: 'task', id: 't2' }, metadata: { taskId: 't2' } })
  assert.equal(second.status, LearningCandidateStatus.CANDIDATE)
  const proposal = await learning.proposeSkill(second.id, { skillRegistry: registry, id: 'repair-jsx-parser', name: 'Repair JSX Parser', description: 'Repair verified JSX parser failures' })
  assert.equal(proposal.skill.status, SkillStatus.CANDIDATE)
})

test('learning evaluation can promote only to TESTED, never APPROVED', async () => {
  const learning = new LearningEngine({ minEvidence: 2 })
  const registry = new SkillRegistry()
  const evals = new EvaluationEngine()
  const base = { problemClass: 'build-failure', strategy: 'localize, patch, build, test', tools: ['repo.read', 'test.run'], verified: true }
  await learning.observe({ ...base, source: { kind: 'task', id: 'a' }, metadata: { taskId: 'a' } })
  const candidate = await learning.observe({ ...base, source: { kind: 'task', id: 'b' }, metadata: { taskId: 'b' } })
  await learning.proposeSkill(candidate.id, { skillRegistry: registry, id: 'repair-build', name: 'Repair Build', description: 'Repair verified build failures' })
  const scenario = { id: 'learning-gate', name: 'learning gate', graders: [{ id: 'verified', dimension: 'outcome', grade: async () => ({ score: 1 }) }], run: async () => ({ output: { ok: true } }) }
  const result = await learning.evaluate(candidate.id, { evaluationEngine: evals, scenario, skillRegistry: registry })
  assert.equal(result.candidate.status, LearningCandidateStatus.TESTED)
  assert.equal(result.skill.status, SkillStatus.TESTED)
  assert.notEqual(result.skill.status, SkillStatus.APPROVED)
})

test('learning rejects unverified experience', async () => {
  const learning = new LearningEngine()
  await assert.rejects(() => learning.observe({ problemClass: 'x', strategy: 'guess', verified: false }))
})
