import { RandAIError, RandAIErrorCode, normalizeRandAIError } from '../core/errors.js'
import { ToolRisk, ToolPermission, toolFailure } from './contracts.js'

const VALID_RISKS = new Set(Object.values(ToolRisk))
const VALID_PERMISSIONS = new Set(Object.values(ToolPermission))

function validateDefinition(definition) {
  if (!definition?.id || !definition?.name || typeof definition.execute !== 'function') {
    throw new TypeError('Tool requires id, name and execute')
  }
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(definition.id)) throw new TypeError(`Invalid tool id: ${definition.id}`)
  if (definition.risk && !VALID_RISKS.has(definition.risk)) throw new TypeError(`Invalid tool risk: ${definition.risk}`)
  if (definition.permission && !VALID_PERMISSIONS.has(definition.permission)) throw new TypeError(`Invalid tool permission: ${definition.permission}`)
}

export class ToolRegistry {
  #tools = new Map()

  register(definition) {
    validateDefinition(definition)
    if (this.#tools.has(definition.id)) throw new Error(`Tool already registered: ${definition.id}`)
    const normalized = Object.freeze({
      description: '', inputSchema: null, outputSchema: null,
      risk: ToolRisk.LOW, permission: ToolPermission.READ,
      timeoutMs: 15000, retryPolicy: { maxAttempts: 1 }, healthCheck: null,
      ...definition,
    })
    this.#tools.set(normalized.id, normalized)
    return normalized
  }

  unregister(id) { return this.#tools.delete(id) }
  has(id) { return this.#tools.has(id) }
  get(id) { return this.#tools.get(id) ?? null }
  list() { return [...this.#tools.values()] }

  discover({ permission, maxRisk, text } = {}) {
    const risks = Object.values(ToolRisk)
    const maxRiskIndex = maxRisk ? risks.indexOf(maxRisk) : risks.length - 1
    const needle = text?.trim().toLowerCase()
    return this.list().filter(tool => {
      if (permission && tool.permission !== permission) return false
      if (risks.indexOf(tool.risk) > maxRiskIndex) return false
      if (needle && !`${tool.id} ${tool.name} ${tool.description}`.toLowerCase().includes(needle)) return false
      return true
    })
  }

  async health() {
    return Promise.all(this.list().map(async tool => {
      if (!tool.healthCheck) return { id: tool.id, status: 'READY' }
      try {
        const result = await tool.healthCheck()
        return { id: tool.id, status: result === false ? 'UNAVAILABLE' : 'READY', details: result ?? null }
      } catch (error) {
        return { id: tool.id, status: 'UNAVAILABLE', error: error?.message || String(error) }
      }
    }))
  }

  async execute(id, input, context = {}) {
    const tool = this.get(id)
    if (!tool) throw new RandAIError(RandAIErrorCode.TOOL_NOT_FOUND, `Unknown tool: ${id}`)
    const health = tool.healthCheck ? await tool.healthCheck() : true
    if (health === false) throw new RandAIError(RandAIErrorCode.TOOL_UNAVAILABLE, `Tool unavailable: ${id}`, { retryable: true })

    const started = Date.now()
    try {
      const value = await tool.execute(input, context)
      return value?.status ? value : { status: 'SUCCESS', data: value, error: null, metadata: { durationMs: Date.now() - started, toolId: id } }
    } catch (error) {
      const normalized = normalizeRandAIError(error, RandAIErrorCode.TOOL_ERROR)
      return toolFailure({ code: normalized.code, message: normalized.message, details: normalized.details }, {
        retryable: normalized.retryable,
        metadata: { durationMs: Date.now() - started, toolId: id },
      })
    }
  }
}
