const freeze = (value) => Object.freeze(value)

export const FaultMode = Object.freeze({
  THROW_BEFORE: 'THROW_BEFORE',
  THROW_AFTER: 'THROW_AFTER',
  RETURN_ERROR: 'RETURN_ERROR',
  DELAY: 'DELAY',
  NONE: 'NONE',
})

const finiteNonNegative = (value, name) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new TypeError(`${name} must be finite and >= 0`)
  return n
}

export function createFaultInjector({ mode = FaultMode.NONE, code = 'INJECTED_FAULT', message = 'Injected fault', delayMs = 0 } = {}) {
  if (!Object.values(FaultMode).includes(mode)) throw new TypeError('Unsupported fault mode')
  const wait = finiteNonNegative(delayMs, 'delayMs')
  return async function inject(operation, ...args) {
    if (typeof operation !== 'function') throw new TypeError('operation must be a function')
    if (mode === FaultMode.DELAY && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    if (mode === FaultMode.THROW_BEFORE) {
      const error = new Error(message); error.code = code; throw error
    }
    const result = await operation(...args)
    if (mode === FaultMode.THROW_AFTER) {
      const error = new Error(message); error.code = code; error.operationResult = result; throw error
    }
    if (mode === FaultMode.RETURN_ERROR) return freeze({ ok: false, error: { code, message } })
    return result
  }
}

export function scriptedFaults(script = []) {
  if (!Array.isArray(script)) throw new TypeError('script must be an array')
  let index = 0
  return async function run(operation, ...args) {
    const fault = script[Math.min(index, script.length - 1)] || { mode: FaultMode.NONE }
    index += 1
    return createFaultInjector(fault)(operation, ...args)
  }
}
