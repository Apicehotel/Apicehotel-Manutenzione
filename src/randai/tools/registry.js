import { RandAIError, RandAIErrorCode, normalizeRandAIError } from '../core/errors.js'
import { ToolRisk, ToolPermission, ToolStatus, toolFailure } from './contracts.js'

const VALID_RISKS = new Set(Object.values(ToolRisk))
const VALID_PERMISSIONS = new Set(Object.values(ToolPermission))

function validateDefinition(definition) {
  if (!definition?.id || !definition?.name || typeof definition.execute !== 'function') {
    throw new TypeError('Tool requires id, name and execute')
  }
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(definition.id)) throw new TypeError(`Invalid tool id: ${definition.id}`)
  if (definition.risk && !VALID_RISKS.has(definition.risk)) throw new TypeError(`Invalid tool risk: ${definition.risk}`)
  if (definition.permission && !VALID_PERMISSIONS.has(definition.permission)) throw new TypeError(`Invalid tool permission: ${definition.permission}`)
  if (definition.healthCheck != null && typeof definition.healthCheck !== 'function') throw new TypeError('Tool healthCheck must be a function')
  if (definition.timeoutMs != null && (!Number.isFinite(Number(definition.timeoutMs)) || Number(definition.timeoutMs) <= 0)) {
    throw new TypeError('Tool timeoutMs must be a positive number')
  }
  if (definition.retryPolicy?.maxAttempts != null && (!Number.isInteger(Number(definition.retryPolicy.maxAttempts)) || Number(definition.retryPolicy.maxAttempts) < 1)) {
    throw new TypeError('Tool retryPolicy.maxAttempts must be an integer >= 1')
  }
  if (definition.retryPolicy?.delayMs != null && (!Number.isFinite(Number(definition.retryPolicy.delayMs)) || Number(definition.retryPolicy.delayMs) < 0)) {
    throw new TypeError('Tool retryPolicy.delayMs must be a number >= 0')
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class ToolRegistry {
  #tools = new Map()

  register(definition) {
    validateDefinition(definition)
    if (this.#tools.has(definition.id)) throw new Error(`Tool already registered: ${definition.id}`)
    const retryPolicy = Object.freeze({
      maxAttempts: 1,
      delayMs: 0,
      ...(definition.retryPolicy ?? {}),
    })
    const normalized = Object.freeze({
      description: '', inputSchema: null, outputSchema: null,
      risk: ToolRisk.LOW, permission: ToolPermission.READ,
      timeoutMs: 15000, healthCheck: null,
      idempotent: false,
      ...definition,
      retryPolicy,
    })
    this.#tools.set(normalized.id, normalized)
    return normalized
  }

  unregister(id) { return this.#tools.delete(id) }
  has(id) { return this.#tools.has(id) }
  get(id) { return this.#tools.get(id) ?? null }
  list() { return [...this.#tools.values()] }

  discover({ permission, maxRisk, text } = {}) {
    if (permission && !VALID_PERMISSIONS.has(permission)) throw new TypeError(`Invalid tool permission filter: ${permission}`)
    if (maxRisk && !VALID_RISKS.has(maxRisk)) throw new TypeError(`Invalid tool maxRisk filter: ${maxRisk}`)
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

    const configuredAttempts = Math.max(1, Number(tool.retryPolicy?.maxAttempts || 1))
    const retrySafe = tool.permission === ToolPermission.READ || tool.idempotent === true
    const maxAttempts = retrySafe ? configuredAttempts : 1
    const timeoutMs = Math.max(1, Number(tool.timeoutMs || 15000))
    const delayMs = Math.max(0, Number(tool.retryPolicy?.delayMs || 0))
    let lastFailure = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = Date.now()
      const controller = new AbortController()
      let timer
      try {
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort(new RandAIError(RandAIErrorCode.TIMEOUT, `Tool timeout after ${timeoutMs}ms: ${id}`))
            reject(new RandAIError(RandAIErrorCode.TIMEOUT, `Tool timeout after ${timeoutMs}ms: ${id}`, { retryable: retrySafe }))
          }, timeoutMs)
        })
        const value = await Promise.race([
          Promise.resolve(tool.execute(input, { ...context, signal: controller.signal, attempt, maxAttempts })),
          timeout,
        ])
        clearTimeout(timer)
        return value?.status ? value : { status: ToolStatus.SUCCESS, data: value, error: null, metadata: { durationMs: Date.now() - started, toolId: id, attempt } }
      } catch (error) {
        clearTimeout(timer)
        const normalized = normalizeRandAIError(error, RandAIErrorCode.TOOL_ERROR)
        const retryable = retrySafe && normalized.retryable === true
        lastFailure = toolFailure({ code: normalized.code, message: normalized.message, details: normalized.details }, {
          status: retryable ? ToolStatus.RETRYABLE : ToolStatus.FAILED,
          retryable,
          metadata: { durationMs: Date.now() - started, toolId: id, attempt, maxAttempts, outcomeUnknown: normalized.code === RandAIErrorCode.TIMEOUT && !retrySafe },
        })
        if (!retryable || attempt >= maxAttempts) return lastFailure
        if (delayMs) await sleep(delayMs)
      }
    }
    return lastFailure
  }
}
