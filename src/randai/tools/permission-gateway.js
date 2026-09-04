import { ToolPermission, ToolRisk } from './contracts.js'

const clone = (value) => value == null ? value : structuredClone(value)
const text = (value) => String(value ?? '').trim()
const PROTECTED_PERMISSIONS = new Set([ToolPermission.WRITE_PROTECTED, ToolPermission.ADMIN])
const PROTECTED_RISKS = new Set([ToolRisk.CRITICAL])

export class ToolPermissionGatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ToolPermissionGatewayError'
    this.code = code
    this.details = clone(details)
  }
}

function deny(code, message, details) {
  throw new ToolPermissionGatewayError(code, message, details)
}

function authorizationAllowed(value) {
  return value === true || value?.allowed === true
}

function toolRequestsOf(plan = {}) {
  const requests = new Map()
  for (const request of Array.isArray(plan.toolRequests) ? plan.toolRequests : []) {
    const id = text(request?.toolId || request?.id)
    if (id) requests.set(id, clone(request))
  }
  return requests
}

export class ToolPermissionGateway {
  constructor({ registry, authorize, eventSink = null, onTelemetryError = null } = {}) {
    if (!registry?.get || typeof registry.get !== 'function') throw new TypeError('ToolPermissionGateway requires a ToolRegistry')
    if (typeof authorize !== 'function') throw new TypeError('ToolPermissionGateway requires authorize')
    if (eventSink != null && typeof eventSink !== 'function') throw new TypeError('eventSink must be a function')
    if (onTelemetryError != null && typeof onTelemetryError !== 'function') throw new TypeError('onTelemetryError must be a function')
    this.registry = registry
    this.authorize = authorize
    this.eventSink = eventSink
    this.onTelemetryError = onTelemetryError
  }

  async #emit(type, data = {}) {
    if (!this.eventSink) return
    const event = { type, at: new Date().toISOString(), ...clone(data) }
    try { await this.eventSink(event) }
    catch (error) {
      if (this.onTelemetryError) await this.onTelemetryError({ error, event: clone(event) }).catch(() => undefined)
    }
  }

  async authorizeTool({ toolId, context = {}, actor = {}, request = {}, runId = null } = {}) {
    const id = text(toolId)
    if (!id) deny('RAND_TOOL_ID_REQUIRED', 'toolId is required')
    const tool = this.registry.get(id)
    if (!tool) {
      await this.#emit('RAND_TOOL_PERMISSION_DENIED', { toolId: id, reason: 'UNKNOWN_TOOL', runId })
      deny('RAND_TOOL_UNKNOWN', `Unknown tool: ${id}`, { toolId: id })
    }

    const hotelId = text(context?.hotelId)
    if (!hotelId) {
      await this.#emit('RAND_TOOL_PERMISSION_DENIED', { toolId: id, reason: 'HOTEL_SCOPE_REQUIRED', runId })
      deny('RAND_TOOL_HOTEL_SCOPE_REQUIRED', `Hotel scope required for tool: ${id}`, { toolId: id })
    }

    const requestedHotelId = text(request?.hotelId || request?.taskHotelId)
    if (requestedHotelId && requestedHotelId !== hotelId) {
      await this.#emit('RAND_TOOL_PERMISSION_DENIED', { toolId: id, reason: 'HOTEL_SCOPE_MISMATCH', hotelId, requestedHotelId, runId })
      deny('RAND_TOOL_SCOPE_MISMATCH', `Tool hotel scope mismatch: ${id}`, { toolId: id, hotelId, requestedHotelId })
    }

    // Risk and permission always come from the canonical registry. Planner/request metadata is never authoritative.
    const canonical = { permission: tool.permission, risk: tool.risk }
    const authorization = await this.authorize({
      action: 'tool.execute',
      tool: { id: tool.id, name: tool.name, permission: tool.permission, risk: tool.risk },
      hotelId,
      actor: clone(actor),
      context: clone(context),
      request: clone(request),
      runId,
    })
    if (!authorizationAllowed(authorization)) {
      const reason = text(authorization?.reason) || 'AUTHORIZATION_DENIED'
      await this.#emit('RAND_TOOL_PERMISSION_DENIED', { toolId: id, reason, hotelId, permission: tool.permission, risk: tool.risk, runId })
      deny('RAND_TOOL_PERMISSION_DENIED', `Tool permission denied: ${id}`, { toolId: id, hotelId, reason, ...canonical })
    }

    const requiresActionGateway = PROTECTED_PERMISSIONS.has(tool.permission) || PROTECTED_RISKS.has(tool.risk)
    if (requiresActionGateway) {
      const approvalId = text(request?.approvalId || authorization?.approvalId)
      const actionGateway = authorization?.actionGateway === true || authorization?.boundary === 'ACTION_GATEWAY'
      if (!approvalId || !actionGateway) {
        await this.#emit('RAND_TOOL_PERMISSION_DENIED', { toolId: id, reason: 'ACTION_GATEWAY_REQUIRED', hotelId, runId })
        deny('RAND_TOOL_ACTION_GATEWAY_REQUIRED', `Protected tool requires Action Gateway approval: ${id}`, {
          toolId: id,
          hotelId,
          permission: tool.permission,
          risk: tool.risk,
        })
      }
    }

    const decision = Object.freeze({
      allowed: true,
      toolId: tool.id,
      hotelId,
      permission: tool.permission,
      risk: tool.risk,
      requiresActionGateway,
      approvalId: requiresActionGateway ? text(request?.approvalId || authorization?.approvalId) : null,
      runId: runId || null,
    })
    await this.#emit('RAND_TOOL_PERMISSION_ALLOWED', decision)
    return decision
  }

  async authorizePlan({ plan = {}, context = {}, actor = {}, runId = null } = {}) {
    const requests = toolRequestsOf(plan)
    const byTool = new Map()
    for (const task of Array.isArray(plan.tasks) ? plan.tasks : []) {
      const taskHotelId = text(task?.hotelId)
      if (taskHotelId && taskHotelId !== text(context?.hotelId)) {
        deny('RAND_TOOL_SCOPE_MISMATCH', `Task hotel scope mismatch: ${text(task?.id) || 'unknown'}`, {
          taskId: text(task?.id), hotelId: text(context?.hotelId), requestedHotelId: taskHotelId,
        })
      }
      for (const toolId of Array.isArray(task?.requiredTools) ? task.requiredTools : []) {
        const id = text(toolId)
        if (id) byTool.set(id, { ...(requests.get(id) || {}), taskHotelId: taskHotelId || text(context?.hotelId) })
      }
    }
    for (const [id, request] of requests) if (!byTool.has(id)) byTool.set(id, request)

    const decisions = []
    for (const [toolId, request] of byTool) {
      decisions.push(await this.authorizeTool({ toolId, context, actor, request, runId }))
    }
    return Object.freeze({ allowed: true, hotelId: text(context?.hotelId), decisions: Object.freeze(decisions) })
  }
}

export function createRandAgentToolPolicyGuard({ gateway, actorProvider = null } = {}) {
  if (!gateway?.authorizePlan || typeof gateway.authorizePlan !== 'function') throw new TypeError('gateway is required')
  if (actorProvider != null && typeof actorProvider !== 'function') throw new TypeError('actorProvider must be a function')
  return async ({ plan, context, runId }) => {
    try {
      const actor = actorProvider ? await actorProvider({ context: clone(context), runId }) : context?.actor || {}
      const result = await gateway.authorizePlan({ plan, context, actor, runId })
      return { allowed: true, toolDecisions: clone(result.decisions) }
    } catch (error) {
      if (!(error instanceof ToolPermissionGatewayError)) throw error
      return { allowed: false, reason: error.message, code: error.code, details: clone(error.details) }
    }
  }
}

export function createToolRegistryExecutionGuard({ gateway, actorProvider = null } = {}) {
  if (!gateway?.authorizeTool || typeof gateway.authorizeTool !== 'function') throw new TypeError('gateway is required')
  if (actorProvider != null && typeof actorProvider !== 'function') throw new TypeError('actorProvider must be a function')
  return async ({ tool, context = {} }) => {
    const actor = actorProvider ? await actorProvider({ context: clone(context), tool: clone(tool) }) : context?.actor || {}
    const request = context?.randToolRequest || {}
    return gateway.authorizeTool({
      toolId: tool.id,
      context,
      actor,
      request,
      runId: context?.randAgent?.runId || null,
    })
  }
}
