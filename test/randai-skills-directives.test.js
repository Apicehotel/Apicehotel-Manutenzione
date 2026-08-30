import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry } from '../src/randai/tools/registry.js'
import { toolSuccess } from '../src/randai/tools/contracts.js'
import { SkillEngine, SkillRegistry, SkillStatus } from '../src/randai/skills/index.js'
import { composeDirective, DirectiveRegistry, DirectiveStatus, directiveToCandidateSkill } from '../src/randai/directives/index.js'

function createEchoToolRegistry() {
  const tools = new ToolRegistry()
  tools.register({
    id: 'demo.echo',
    name: 'Echo',
    description: 'Returns the supplied value',
    execute: async input => toolSuccess(input),
  })
  return tools
}

test('Skill Registry uses progressive disclosure and controlled lifecycle', () => {
  const registry = new SkillRegistry()
  registry.register({
    id: 'safe-demo',
    name: 'Safe demo',
    version: '1.0.0',
    description: 'A reusable safe workflow',
    requiredTools: ['demo.echo'],
    instructions: ['Call the echo tool'],
    run: async () => 'ok',
  })

  const [summary] = registry.list()
  assert.equal(summary.id, 'safe-demo')
  assert.equal('instructions' in summary, false)
  assert.equal('run' in summary, false)
  assert.deepEqual(registry.inspect('safe-demo', '1.0.0').instructions, ['Call the echo tool'])
  assert.throws(() => registry.transition('safe-demo', '1.0.0', SkillStatus.APPROVED), /Invalid skill transition/)
  registry.transition('safe-demo', '1.0.0', SkillStatus.CANDIDATE)
  registry.transition('safe-demo', '1.0.0', SkillStatus.TESTED)
  assert.equal(registry.transition('safe-demo', '1.0.0', SkillStatus.APPROVED).status, SkillStatus.APPROVED)
})

test('Skill Engine validates tool dependencies and executes only approved skills', async () => {
  const tools = createEchoToolRegistry()
  const registry = new SkillRegistry()
  registry.register({
    id: 'echo-workflow',
    name: 'Echo workflow',
    version: '1.0.0',
    description: 'Uses the declared echo tool',
    requiredTools: ['demo.echo'],
    run: async ({ input, useTool }) => {
      const result = await useTool('demo.echo', input)
      return result.data
    },
  })
  const engine = new SkillEngine({ registry, toolRegistry: tools })

  await assert.rejects(() => engine.execute({ skillId: 'echo-workflow', input: { value: 7 } }), /not approved/)
  registry.transition('echo-workflow', '1.0.0', SkillStatus.CANDIDATE)
  registry.transition('echo-workflow', '1.0.0', SkillStatus.TESTED)
  registry.transition('echo-workflow', '1.0.0', SkillStatus.APPROVED)
  assert.deepEqual(engine.validateDependencies('echo-workflow', '1.0.0'), { valid: true, missingTools: [] })

  const execution = await engine.execute({ skillId: 'echo-workflow', objective: 'Echo safely', input: { value: 7 } })
  assert.equal(execution.task.status, 'SUCCEEDED')
  assert.deepEqual(execution.result.data, { value: 7 })
})

test('Skill Engine prevents undeclared tool use', async () => {
  const tools = createEchoToolRegistry()
  tools.register({ id: 'demo.other', name: 'Other', execute: async () => toolSuccess('unsafe') })
  const registry = new SkillRegistry()
  registry.register({
    id: 'restricted-workflow',
    name: 'Restricted workflow',
    version: '1.0.0',
    description: 'May only use its declared tools',
    requiredTools: ['demo.echo'],
    run: async ({ useTool }) => useTool('demo.other', {}),
  })
  registry.transition('restricted-workflow', '1.0.0', SkillStatus.CANDIDATE)
  registry.transition('restricted-workflow', '1.0.0', SkillStatus.TESTED)
  registry.transition('restricted-workflow', '1.0.0', SkillStatus.APPROVED)

  const execution = await new SkillEngine({ registry, toolRegistry: tools }).execute({ skillId: 'restricted-workflow', input: {} })
  assert.equal(execution.task.status, 'FAILED')
  assert.match(execution.result.error.message, /undeclared tool/)
})

test('Directive Composer preserves original text and requires explicit approval', () => {
  const raw = 'Sistema il problema su GitHub. Non modificare main. Esegui build e test e verifica il diff.'
  const composition = composeDirective(raw, { title: 'Fix GitHub sicuro' })
  assert.equal(composition.original, raw)
  assert.equal(composition.requiresApproval, true)
  assert.deepEqual(composition.forbidden, ['Non modificare main.'])
  assert.deepEqual(composition.successCriteria, ['Esegui build e test e verifica il diff.'])

  const directives = new DirectiveRegistry()
  const proposed = directives.create(composition)
  assert.equal(proposed.status, DirectiveStatus.PROPOSED)
  const approved = directives.approve(proposed.id)
  assert.equal(approved.status, DirectiveStatus.APPROVED)
  assert.equal(approved.requiresApproval, false)

  const revised = directives.revise(proposed.id, { rules: [...approved.rules, 'Controlla HEAD prima di scrivere.'] })
  assert.equal(revised.version, 2)
  assert.equal(revised.status, DirectiveStatus.PROPOSED)
  assert.equal(directives.history(proposed.id)[0].status, DirectiveStatus.SUPERSEDED)
})

test('Only an approved directive can become a candidate skill', () => {
  const directives = new DirectiveRegistry()
  const proposed = directives.create(composeDirective('Analizza il problema. Esegui test e verifica il risultato.', { title: 'Analisi verificata' }))
  assert.throws(() => directiveToCandidateSkill(proposed), /Only approved directives/)

  const approved = directives.approve(proposed.id)
  const candidate = directiveToCandidateSkill(approved, { id: 'verified-analysis', requiredTools: ['demo.echo'] })
  assert.equal(candidate.status, SkillStatus.CANDIDATE)
  assert.equal(candidate.metadata.sourceDirectiveId, approved.id)

  const skills = new SkillRegistry()
  skills.register(candidate)
  assert.equal(skills.inspect('verified-analysis', '0.1.0').status, SkillStatus.CANDIDATE)
  assert.equal(skills.discover({ text: 'verified' }).length, 0)
  assert.equal(skills.discover({ text: 'verified', status: SkillStatus.CANDIDATE }).length, 1)
})
