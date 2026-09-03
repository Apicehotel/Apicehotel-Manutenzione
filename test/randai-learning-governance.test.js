import test from 'node:test'
import assert from 'node:assert/strict'
import { LearningEngine, LearningCandidateStatus } from '../src/randai/learning/index.js'
import { SkillRegistry } from '../src/randai/skills/registry.js'
import { SkillStatus } from '../src/randai/skills/contracts.js'
import { EvaluationEngine } from '../src/randai/evals/engine.js'

const experience = (taskId, hotelId = 'hotelgio') => ({
  hotelId,
  problemClass: 'lampada-fulminata',
  strategy: 'sostituire lampada e verificare accensione',
  tools: ['inventory.lookup', 'human.checkpoint'],
  verified: true,
  source: { kind: 'task', id: taskId },
  metadata: { hotelId, taskId },
})

test('learning requires traceable evidence and deduplicates the same run', async () => {
  const engine = new LearningEngine()
  await assert.rejects(() => engine.observe({
    hotelId: 'hotelgio',
    problemClass: 'x',
    strategy: 'y',
    verified: true,
  }), /source.id/)

  const first = await engine.observe(experience('task-1'))
  const duplicate = await engine.observe(experience('task-1'))
  assert.equal(first.id, duplicate.id)
  assert.equal(duplicate.evidence.length, 1)
  const second = await engine.observe(experience('task-2'))
  assert.equal(second.status, LearningCandidateStatus.CANDIDATE)
  assert.equal(second.evidence.length, 2)
})

test('learning approval is explicit, scoped and only possible after TESTED', async () => {
  const engine = new LearningEngine()
  const registry = new SkillRegistry()
  const first = await engine.observe(experience('task-a'))
  const candidate = await engine.observe(experience('task-b'))
  await engine.proposeSkill(candidate.id, {
    skillRegistry: registry,
    id: 'replace-lamp',
    name: 'Replace lamp',
    description: 'Verified lamp replacement',
  })
  await assert.rejects(() => engine.approve(candidate.id, { skillRegistry: registry }), /approvedBy/)

  const evaluationEngine = new EvaluationEngine()
  const scenario = {
    id: 'approval-gate',
    name: 'approval gate',
    graders: [{ id: 'outcome', dimension: 'outcome', grade: async () => ({ score: 1 }) }],
    run: async () => ({ output: { ok: true } }),
  }
  const tested = await engine.evaluate(candidate.id, { evaluationEngine, scenario, skillRegistry, hotelId: 'hotelgio' })
  assert.equal(tested.candidate.status, LearningCandidateStatus.TESTED)
  assert.equal(tested.skill.status, SkillStatus.TESTED)

  const approved = await engine.approve(candidate.id, { skillRegistry: registry, approvedBy: 'direzione', hotelId: 'hotelgio' })
  assert.equal(approved.candidate.approvedBy, 'direzione')
  assert.equal(approved.skill.status, SkillStatus.APPROVED)
  await assert.rejects(() => engine.approve(candidate.id, { skillRegistry: registry, approvedBy: 'altro', hotelId: 'chocohotel' }), /out-of-scope|before approval/)
  assert.equal(first.status, LearningCandidateStatus.OBSERVED)
})
