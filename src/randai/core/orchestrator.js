import { createTask, transitionTask } from './task.js'
import { createLogger } from './logger.js'
import { ToolStatus } from '../tools/contracts.js'

export class RandAIOrchestrator {
  constructor({ registry, logger = createLogger() } = {}) {
    if (!registry) throw new TypeError('Tool registry is required')
    this.registry = registry
    this.logger = logger
  }

  discoverTools(query = {}) { return this.registry.discover(query) }

  async executeTool({ objective, toolId, input, metadata = {}, context = {} }) {
    const task = createTask({ objective, metadata })
    const log = this.logger.child({ taskId: task.id, toolId })
    transitionTask(task, 'RUNNING', { toolId })
    log.info('task.started', { objective: task.objective })
    const result = await this.registry.execute(toolId, input, { ...context, task })
    const ok = result.status === ToolStatus.SUCCESS || result.status === ToolStatus.PARTIAL
    transitionTask(task, ok ? 'SUCCEEDED' : 'FAILED', { toolId, toolStatus: result.status })
    log.info('task.completed', { status: task.status, toolStatus: result.status })
    return { task, result }
  }
}
