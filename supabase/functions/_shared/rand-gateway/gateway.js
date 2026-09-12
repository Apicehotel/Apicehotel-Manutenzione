import { createRandEnvelope, envelopeIdempotencyKey, RandEnvelopeError } from './envelope.js'

const MUTATION_PERMISSIONS = new Set(['WRITE', 'WRITE_PROTECTED', 'ADMIN'])
const SENSITIVE_RISKS = new Set(['HIGH', 'CRITICAL'])
const clone = (value) => value == null ? value : structuredClone(value)

export class RandGatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'RandGatewayError'
    this.code = code
    this.details = clone(details)
  }
}

function requireDependency(value, name, method) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${name}.${method} is required`)
}

export class RandGateway {
  constructor({ store, identity, tools, hitl, actions } = {}) {
    requireDependency(store, 'store', 'accept')
    requireDependency(store, 'store', 'transition')
    requireDependency(store, 'store', 'audit')
    requireDependency(identity, 'identity', 'resolve')
    requireDependency(tools, 'tools', 'authorize')
    requireDependency(hitl, 'hitl', 'request')
    requireDependency(hitl, 'hitl', 'verify')
    requireDependency(actions, 'actions', 'execute')
    this.store = store
    this.identity = identity
    this.tools = tools
    this.hitl = hitl
    this.actions = actions
  }

  async #audit(envelope, stage, decision, code, detail = {}) {
    await this.store.audit({ envelopeId: envelope.id, hotelId: envelope.actor.hotelId, stage, decision, code, detail: clone(detail) })
  }

  async handle(input) {
    let envelope
    try { envelope = createRandEnvelope(input) }
    catch (error) {
      if (error instanceof RandEnvelopeError) throw new RandGatewayError(error.code, error.message, error.details)
      throw error
    }

    const idempotencyKey = envelopeIdempotencyKey(envelope)
    const accepted = await this.store.accept({ envelope, idempotencyKey })
    if (accepted?.replayed) return Object.freeze({ ...clone(accepted.result), replayed: true })
    await this.#audit(envelope, 'ingress', 'accepted', 'RAND_GATEWAY_ACCEPTED', { channel: envelope.channel })

    const resolved = await this.identity.resolve(envelope)
    const actor = Object.freeze({
      userId: resolved?.userId || null,
      hotelId: resolved?.hotelId || envelope.actor.hotelId || null,
      roleId: resolved?.roleId || null,
      scopes: Object.freeze([...(resolved?.scopes || [])]),
      authenticated: resolved?.authenticated === true,
      identityConfidence: resolved?.identityConfidence || 'none',
    })
    if (envelope.actor.hotelId && actor.hotelId && envelope.actor.hotelId !== actor.hotelId) {
      await this.store.transition(envelope.id, 'rejected', { code: 'RAND_GATEWAY_HOTEL_MISMATCH' })
      await this.#audit(envelope, 'identity', 'denied', 'RAND_GATEWAY_HOTEL_MISMATCH')
      throw new RandGatewayError('RAND_GATEWAY_HOTEL_MISMATCH', 'Identità e hotel richiesto non coincidono')
    }

    if (envelope.payload.type !== 'tool_request') {
      const result = Object.freeze({ ok: true, status: 'accepted', envelopeId: envelope.id })
      await this.store.transition(envelope.id, 'accepted', { actor, result })
      await this.#audit(envelope, 'message', 'accepted', 'RAND_GATEWAY_MESSAGE_ACCEPTED')
      return result
    }

    if (!actor.authenticated || !actor.userId || !actor.hotelId) {
      const approval = await this.hitl.request({ envelope, actor, reason: 'IDENTITY_VERIFICATION_REQUIRED' })
      const result = Object.freeze({ ok: true, status: 'pending_identity', envelopeId: envelope.id, approvalId: approval?.id || null })
      await this.store.transition(envelope.id, 'pending', { actor, result })
      await this.#audit(envelope, 'identity', 'pending', 'RAND_GATEWAY_IDENTITY_REQUIRED')
      return result
    }

    const toolRequest = envelope.payload.toolRequest
    const decision = await this.tools.authorize({
      envelope,
      toolName: toolRequest.name,
      actor,
      hotelId: actor.hotelId,
      targetHotelId: toolRequest.targetHotelId || actor.hotelId,
      grantedScopes: actor.scopes,
    })
    if (!decision?.allowed) {
      const code = decision?.code || 'RAND_GATEWAY_TOOL_DENIED'
      await this.store.transition(envelope.id, 'rejected', { actor, decision })
      await this.#audit(envelope, 'tool_gateway', 'denied', code, { toolName: toolRequest.name })
      throw new RandGatewayError(code, decision?.reason || 'Tool non autorizzato')
    }

    const permission = String(decision.permission || 'READ').toUpperCase()
    const risk = String(decision.risk || 'CRITICAL').toUpperCase()
    const requiresHitl = decision.requiresHitl !== false
      && (MUTATION_PERMISSIONS.has(permission) || SENSITIVE_RISKS.has(risk))

    if (requiresHitl) {
      if (!toolRequest.approvalId) {
        const approval = await this.hitl.request({ envelope, actor, decision, reason: 'SENSITIVE_ACTION_CONFIRMATION_REQUIRED' })
        const result = Object.freeze({ ok: true, status: 'pending_approval', envelopeId: envelope.id, approvalId: approval?.id || null })
        await this.store.transition(envelope.id, 'pending', { actor, decision, result })
        await this.#audit(envelope, 'hitl', 'pending', 'RAND_GATEWAY_APPROVAL_REQUIRED', { toolName: toolRequest.name })
        return result
      }
      const approval = await this.hitl.verify({ approvalId: toolRequest.approvalId, envelope, actor, decision })
      if (!approval?.approved) {
        await this.store.transition(envelope.id, 'rejected', { actor, decision })
        await this.#audit(envelope, 'hitl', 'denied', 'RAND_GATEWAY_APPROVAL_DENIED')
        throw new RandGatewayError('RAND_GATEWAY_APPROVAL_DENIED', 'Approvazione non valida o scaduta')
      }
    }

    // The adapter never receives an executor. All execution crosses this boundary.
    const execution = await this.actions.execute({ envelope, actor, decision, approvalId: toolRequest.approvalId })
    const result = Object.freeze({ ok: true, status: 'executed', envelopeId: envelope.id, result: clone(execution) })
    await this.store.transition(envelope.id, 'executed', { actor, decision, result })
    await this.#audit(envelope, 'action_gateway', 'executed', 'RAND_GATEWAY_EXECUTED', { toolName: toolRequest.name })
    return result
  }
}
