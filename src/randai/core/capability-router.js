export const CapabilityProviderStatus = Object.freeze({
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  DISABLED: 'DISABLED',
})

export class CapabilityRoutingError extends Error {
  constructor(code, message, detail = null) {
    super(message)
    this.name = 'CapabilityRoutingError'
    this.code = code
    this.detail = detail
  }
}

function normalizeCapability(value) {
  const capability = String(value || '').trim()
  if (!capability) throw new CapabilityRoutingError('CAPABILITY_REQUIRED', 'Capability obbligatoria')
  return capability
}

function normalizeProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Capability provider non valido')
  }
  const id = String(provider.id || '').trim()
  if (!id) throw new TypeError('Capability provider id obbligatorio')
  if (typeof provider.execute !== 'function') throw new TypeError(`Capability provider ${id}: execute obbligatorio`)

  const capabilities = [...new Set((provider.capabilities || []).map(normalizeCapability))]
  if (!capabilities.length) throw new TypeError(`Capability provider ${id}: capabilities obbligatorie`)

  return Object.freeze({
    id,
    capabilities: Object.freeze(capabilities),
    priority: Number.isFinite(provider.priority) ? Number(provider.priority) : 100,
    execute: provider.execute,
    isAvailable: typeof provider.isAvailable === 'function' ? provider.isAvailable : () => true,
    getHealth: typeof provider.getHealth === 'function' ? provider.getHealth : null,
  })
}

function normalizeHealth(value) {
  if (!value) return { status: CapabilityProviderStatus.HEALTHY }
  if (typeof value === 'string') return { status: value }
  return { ...value, status: value.status || CapabilityProviderStatus.HEALTHY }
}

function isRetrySafe(error) {
  return error?.safeToRetry === true || error?.code === 'CAPABILITY_PROVIDER_UNAVAILABLE'
}

export class RandCapabilityRouter {
  #providers = new Map()
  #onTrace
  #now

  constructor({ onTrace = null, now = () => Date.now() } = {}) {
    this.#onTrace = typeof onTrace === 'function' ? onTrace : null
    this.#now = now
  }

  #emitTrace(trace) {
    try {
      this.#onTrace?.(trace)
    } catch {
      // Telemetry must never change capability execution semantics.
    }
  }

  register(provider) {
    const normalized = normalizeProvider(provider)
    if (this.#providers.has(normalized.id)) {
      throw new CapabilityRoutingError('CAPABILITY_PROVIDER_DUPLICATE', `Provider già registrato: ${normalized.id}`)
    }
    this.#providers.set(normalized.id, normalized)
    return () => this.unregister(normalized.id)
  }

  unregister(providerId) {
    return this.#providers.delete(String(providerId || '').trim())
  }

  listProviders({ capability = null } = {}) {
    const target = capability ? normalizeCapability(capability) : null
    return [...this.#providers.values()]
      .filter((provider) => !target || provider.capabilities.includes(target))
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .map((provider) => Object.freeze({
        id: provider.id,
        capabilities: provider.capabilities,
        priority: provider.priority,
      }))
  }

  async #candidates(capability, context) {
    const providers = [...this.#providers.values()]
      .filter((provider) => provider.capabilities.includes(capability))
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))

    const candidates = []
    for (const provider of providers) {
      let available = false
      try {
        available = await provider.isAvailable({ capability, context })
      } catch {
        available = false
      }
      if (available) candidates.push(provider)
    }
    return candidates
  }

  async invoke(capability, input = {}, {
    context = null,
    allowExecutionFallback = false,
  } = {}) {
    const target = normalizeCapability(capability)
    const startedAt = this.#now()
    const candidates = await this.#candidates(target, context)

    if (!candidates.length) {
      const trace = Object.freeze({
        capability: target,
        providerId: null,
        status: 'UNAVAILABLE',
        fallbackCount: 0,
        durationMs: Math.max(0, this.#now() - startedAt),
      })
      this.#emitTrace(trace)
      throw new CapabilityRoutingError(
        'CAPABILITY_UNAVAILABLE',
        `Nessun provider disponibile per ${target}`,
        trace,
      )
    }

    let fallbackCount = 0
    let lastError = null

    for (let index = 0; index < candidates.length; index += 1) {
      const provider = candidates[index]
      const attemptStartedAt = this.#now()
      try {
        const value = await provider.execute({ capability: target, input, context })
        const trace = Object.freeze({
          capability: target,
          providerId: provider.id,
          status: 'SUCCESS',
          fallbackCount,
          durationMs: Math.max(0, this.#now() - startedAt),
          providerDurationMs: Math.max(0, this.#now() - attemptStartedAt),
        })
        this.#emitTrace(trace)
        return Object.freeze({ value, trace })
      } catch (error) {
        lastError = error
        const canFallback = allowExecutionFallback && isRetrySafe(error) && index < candidates.length - 1
        if (!canFallback) {
          const trace = Object.freeze({
            capability: target,
            providerId: provider.id,
            status: 'ERROR',
            fallbackCount,
            durationMs: Math.max(0, this.#now() - startedAt),
            errorCode: String(error?.code || error?.name || 'Error').slice(0, 100),
          })
          this.#emitTrace(trace)
          if (error && typeof error === 'object' && !error.capabilityTrace) {
            try { error.capabilityTrace = trace } catch { /* immutable error */ }
          }
          throw error
        }
        fallbackCount += 1
      }
    }

    throw lastError || new CapabilityRoutingError('CAPABILITY_UNAVAILABLE', `Nessun provider eseguibile per ${target}`)
  }

  async healthSnapshot({ context = null } = {}) {
    const rows = []
    for (const provider of this.#providers.values()) {
      let available = false
      let health = { status: CapabilityProviderStatus.HEALTHY }
      try {
        available = await provider.isAvailable({ capability: null, context })
        if (provider.getHealth) health = normalizeHealth(await provider.getHealth({ context }))
      } catch (error) {
        health = { status: CapabilityProviderStatus.DEGRADED, reason: String(error?.code || error?.message || 'health_failed') }
      }

      if (!available && health.status === CapabilityProviderStatus.HEALTHY) {
        health = { ...health, status: CapabilityProviderStatus.DISABLED }
      }

      rows.push(Object.freeze({
        id: provider.id,
        capabilities: provider.capabilities,
        priority: provider.priority,
        available,
        ...health,
      }))
    }

    return Object.freeze(rows.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)))
  }
}
