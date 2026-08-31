const frozen = (value) => Object.freeze(value)

export const SafeWriteCode = frozen({
  INVALID_CONTRACT: 'SAFE_WRITE_INVALID_CONTRACT',
  NOT_CONFIRMED: 'SAFE_WRITE_NOT_CONFIRMED',
  VERIFY_FAILED: 'SAFE_WRITE_VERIFY_FAILED',
  CONFLICT: 'SAFE_WRITE_CONFLICT',
})

export class SafeWriteError extends Error {
  constructor(code, message, { operation = null, details = null, cause = null } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'SafeWriteError'
    this.code = code
    this.operation = operation
    this.details = details
  }
}

export function createMutationId(prefix = 'RND-MUT') {
  const uuid = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${uuid}`
}

function assertContract({ write, readBack }) {
  if (typeof write !== 'function' || typeof readBack !== 'function') {
    throw new SafeWriteError(
      SafeWriteCode.INVALID_CONTRACT,
      'Safe Write richiede write e readBack',
    )
  }
}

function verificationOk(result) {
  if (result === undefined || result === null || result === true) return true
  if (result === false) return false
  if (typeof result === 'object' && 'ok' in result) return result.ok === true
  return Boolean(result)
}

/**
 * Coordina una singola scrittura affidabile senza introdurre retry nascosti.
 *
 * Fasi: preflight -> idempotency lookup -> write -> read-back -> verify.
 * L'atomicita' della mutazione resta responsabilita' del database/RPC.
 */
export async function safeWrite({
  operation = 'write',
  preflight = null,
  idempotencyLookup = null,
  write,
  readBack,
  verify = null,
  expectation = 'present',
} = {}) {
  assertContract({ write, readBack })
  if (!['present', 'absent'].includes(expectation)) {
    throw new SafeWriteError(SafeWriteCode.INVALID_CONTRACT, `Expectation Safe Write non valida: ${expectation}`, { operation })
  }

  if (typeof preflight === 'function') await preflight()

  let writeResult = null
  let idempotencyHit = false
  if (typeof idempotencyLookup === 'function') {
    const existing = await idempotencyLookup()
    if (existing !== undefined && existing !== null) {
      writeResult = existing
      idempotencyHit = true
    }
  }

  if (!idempotencyHit) writeResult = await write()

  const persisted = await readBack({ writeResult, idempotencyHit })
  const presenceOk = expectation === 'present' ? persisted !== null && persisted !== undefined : persisted === null || persisted === undefined
  if (!presenceOk) {
    throw new SafeWriteError(
      SafeWriteCode.NOT_CONFIRMED,
      expectation === 'present' ? 'Scrittura non confermata dal read-back' : 'Eliminazione non confermata dal read-back',
      { operation, details: { expectation } },
    )
  }

  if (typeof verify === 'function') {
    const result = await verify(persisted, { writeResult, idempotencyHit })
    if (!verificationOk(result)) {
      throw new SafeWriteError(
        SafeWriteCode.VERIFY_FAILED,
        'Il dato persistito non corrisponde all’operazione richiesta',
        { operation, details: result && typeof result === 'object' ? result : null },
      )
    }
  }

  return frozen({
    ok: true,
    value: persisted,
    writeResult,
    idempotencyHit,
    operation,
  })
}

export function safeWriteConflict(message = 'Il record è cambiato dopo il caricamento', details = null) {
  return new SafeWriteError(SafeWriteCode.CONFLICT, message, { details })
}
