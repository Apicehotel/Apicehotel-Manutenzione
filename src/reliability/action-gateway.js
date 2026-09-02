import { assertOperationalContext } from './operational-context.js'
import { assertContextScope } from './context-scope-guard.js'
import { assertValid } from './validation-engine.js'
import { safeWrite } from './safe-write-engine.js'

const text = (value) => String(value ?? '').trim()
const frozen = (value) => Object.freeze(value)

export const ActionRisk = frozen({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' })

export class ActionGatewayError extends Error {
  constructor(code, message, details = null) {
    super(message)
    this.name = 'ActionGatewayError'
    this.code = code
    this.details = details
  }
}

export class ActionGateway {
  constructor({ authorize, audit = null } = {}) {
    if (typeof authorize !== 'function') throw new TypeError('authorize is required')
    if (audit !== null && typeof audit !== 'function') throw new TypeError('audit must be a function')
    this.authorize = authorize
    this.audit = audit
  }

  async execute({
    context,
    operation,
    module,
    action,
    permission,
    risk = ActionRisk.MEDIUM,
    record = null,
    validation = null,
    idempotencyLookup = null,
    write,
    readBack,
    verify = null,
    expectation = 'present',
  } = {}) {
    assertOperationalContext(context)
    if (context.global) throw new ActionGatewayError('GLOBAL_WRITE_BLOCKED', 'operational writes require hotel scope')
    if (!text(operation) || !text(module) || !text(action) || !text(permission)) {
      throw new ActionGatewayError('INVALID_ACTION_CONTRACT', 'operation, module, action and permission are required')
    }
    if (!Object.values(ActionRisk).includes(risk)) throw new ActionGatewayError('INVALID_RISK', 'invalid action risk')

    const permissionAllowed = await this.authorize({ context, module, action, permission, risk, record })
    assertContextScope({
      expected: {
        hotelId: context.hotelId,
        userId: context.actor?.userId,
        module,
        recordId: record?.id || null,
        recordType: record?.type || null,
      },
      context,
      record,
      permissionAllowed: permissionAllowed === true,
      requireActor: true,
    })
    if (validation) assertValid(validation, `Action Gateway: ${operation}`)

    const receiptBase = {
      operation,
      module,
      action,
      permission,
      risk,
      hotelId: context.hotelId,
      actorId: context.actor?.userId || null,
      recordId: record?.id || null,
      recordType: record?.type || null,
    }

    try {
      const result = await safeWrite({ operation, idempotencyLookup, write, readBack, verify, expectation })
      const receipt = frozen({ ...receiptBase, ok: true, idempotencyHit: result.idempotencyHit, completedAt: new Date().toISOString() })
      if (this.audit) await this.audit(receipt)
      return frozen({ ...result, receipt })
    } catch (error) {
      if (this.audit) {
        try {
          await this.audit(frozen({ ...receiptBase, ok: false, errorCode: error?.code || 'WRITE_FAILED', completedAt: new Date().toISOString() }))
        } catch {}
      }
      throw error
    }
  }
}
