import { createTask, transitionTask } from '../core/task.js'
import { createLogger } from '../core/logger.js'
import { SkillStatus } from './contracts.js'

export class SkillEngine {
  constructor({ registry, toolRegistry, logger = createLogger() } = {}) {
    if (!registry) throw new TypeError('Skill registry is required')
    if (!toolRegistry) throw new TypeError('Tool registry is required')
    this.registry = registry
    this.toolRegistry = toolRegistry
    this.logger = logger
  }

  discover(query = {}) { return this.registry.discover(query) }
  inspect(id, version) { return this.registry.inspect(id, version) }

  validateDependencies(id, version) {
    const skill = this.registry.inspect(id, version)
    if (!skill) throw new Error(`Unknown skill: ${id}${version ? `@${version}` : ''}`)
    const missingTools = skill.requiredTools.filter(toolId => !this.toolRegistry.has(toolId))
    return { valid: missingTools.length === 0, missingTools }
  }

  async execute({ skillId, version, objective, input, metadata = {}, context = {} }) {
    const skill = this.registry.inspect(skillId, version)
    if (!skill) throw new Error(`Unknown skill: ${skillId}${version ? `@${version}` : ''}`)
    if (skill.status !== SkillStatus.APPROVED) throw new Error(`Skill is not approved: ${skill.id}@${skill.version}`)
    if (typeof skill.run !== 'function') throw new Error(`Skill has no executable runtime: ${skill.id}@${skill.version}`)

    const dependencies = this.validateDependencies(skill.id, skill.version)
    if (!dependencies.valid) throw new Error(`Missing required tools: ${dependencies.missingTools.join(', ')}`)

    const task = createTask({ objective: objective || skill.name, metadata: { ...metadata, skillId: skill.id, skillVersion: skill.version } })
    const log = this.logger.child({ taskId: task.id, skillId: skill.id, skillVersion: skill.version })
    transitionTask(task, 'RUNNING', { skillId: skill.id })

    const allowedTools = new Set(skill.requiredTools)
    const useTool = async (toolId, toolInput, toolContext = {}) => {
      if (!allowedTools.has(toolId)) throw new Error(`Skill cannot use undeclared tool: ${toolId}`)
      return this.toolRegistry.execute(toolId, toolInput, { ...context, ...toolContext, task, skill: { id: skill.id, version: skill.version } })
    }

    log.info('skill.started', { objective: task.objective })
    try {
      const data = await skill.run({ input, context, task, useTool, skill })
      transitionTask(task, 'SUCCEEDED', { skillId: skill.id })
      log.info('skill.completed', { status: task.status })
      return { task, result: { status: 'SUCCESS', data, error: null, metadata: { skillId: skill.id, skillVersion: skill.version } } }
    } catch (error) {
      transitionTask(task, 'FAILED', { skillId: skill.id, error: error?.message || String(error) })
      log.error('skill.failed', { error: error?.message || String(error) })
      return { task, result: { status: 'FAILED', data: null, error: { message: error?.message || String(error) }, metadata: { skillId: skill.id, skillVersion: skill.version } } }
    }
  }
}
