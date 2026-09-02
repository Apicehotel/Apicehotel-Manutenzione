import { PrivacyLevel, RoutingPriority, validateModelDescriptor, validateRouteRequest } from './contracts.js'

const PRIVACY_RANK = Object.freeze({
  [PrivacyLevel.PUBLIC]: 0,
  [PrivacyLevel.STANDARD]: 1,
  [PrivacyLevel.SENSITIVE]: 2,
  [PrivacyLevel.LOCAL_ONLY]: 3,
})

const clone = (value) => structuredClone(value)
const normalize = (value, fallback = 0.5) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback

function scoreModel(model, request) {
  const quality = normalize(model.quality, 0.5)
  const reliability = normalize(model.reliability, 0.5)
  const costEfficiency = 1 - normalize(model.cost, 0.5)
  const latencyEfficiency = 1 - normalize(model.latency, 0.5)
  const priority = request.priority || RoutingPriority.BALANCED
  const weights = {
    [RoutingPriority.QUALITY]: [0.55, 0.30, 0.05, 0.10],
    [RoutingPriority.BALANCED]: [0.35, 0.30, 0.15, 0.20],
    [RoutingPriority.COST]: [0.20, 0.25, 0.45, 0.10],
    [RoutingPriority.LATENCY]: [0.20, 0.25, 0.10, 0.45],
    [RoutingPriority.PRIVACY]: [0.30, 0.35, 0.15, 0.20],
  }[priority]
  return quality * weights[0] + reliability * weights[1] + costEfficiency * weights[2] + latencyEfficiency * weights[3]
}

export class ModelRouter {
  #models = new Map()

  constructor({ models = [] } = {}) { models.forEach((model) => this.register(model)) }

  register(input) {
    validateModelDescriptor(input)
    if (this.#models.has(input.id)) throw new Error(`Model already registered: ${input.id}`)
    const model = {
      privacy: PrivacyLevel.STANDARD,
      reliability: 0.5,
      quality: 0.5,
      cost: 0.5,
      latency: 0.5,
      contextWindow: 0,
      enabled: true,
      metadata: {},
      ...clone(input),
    }
    this.#models.set(model.id, model)
    return clone(model)
  }

  list() { return [...this.#models.values()].map(clone) }
  get(id) { const model = this.#models.get(id); return model ? clone(model) : null }

  route(request = {}) {
    validateRouteRequest(request)
    const required = new Set(request.requiredCapabilities || [])
    const minPrivacy = PRIVACY_RANK[request.privacy || PrivacyLevel.PUBLIC]
    const minContext = Number(request.minContextWindow || 0)
    const excluded = new Set(request.excludeModelIds || [])
    const candidates = [...this.#models.values()]
      .filter((model) => model.enabled !== false)
      .filter((model) => !excluded.has(model.id))
      .filter((model) => [...required].every((capability) => model.capabilities.includes(capability)))
      .filter((model) => PRIVACY_RANK[model.privacy] >= minPrivacy)
      .filter((model) => Number(model.contextWindow || 0) >= minContext)
      .map((model) => ({ model, score: scoreModel(model, request) }))
      .sort((a, b) => b.score - a.score || b.model.reliability - a.model.reliability || a.model.id.localeCompare(b.model.id))

    if (!candidates.length) {
      return { selected: null, fallbacks: [], reason: 'NO_COMPATIBLE_MODEL', request: clone(request) }
    }

    return {
      selected: clone(candidates[0].model),
      fallbacks: candidates.slice(1).map(({ model }) => clone(model)),
      score: candidates[0].score,
      reason: 'BEST_COMPATIBLE_MODEL',
      request: clone(request),
    }
  }

  async execute(request, invoke, { maxFallbacks = 2, retryable = () => true } = {}) {
    if (typeof invoke !== 'function') throw new TypeError('invoke must be a function')
    if (!Number.isInteger(Number(maxFallbacks)) || Number(maxFallbacks) < 0) throw new TypeError('maxFallbacks must be an integer >= 0')
    if (typeof retryable !== 'function') throw new TypeError('retryable must be a function')
    const route = this.route(request)
    if (!route.selected) return { ok: false, route, attempts: [], error: new Error(route.reason) }
    const sequence = [route.selected, ...route.fallbacks.slice(0, Number(maxFallbacks))]
    const attempts = []
    let lastError = null
    for (const model of sequence) {
      try {
        const result = await invoke(model)
        attempts.push({ modelId: model.id, status: 'SUCCESS' })
        return { ok: true, model, result, attempts, route }
      } catch (error) {
        lastError = error
        attempts.push({ modelId: model.id, status: 'FAILED', error: String(error?.message || error) })
        if (!retryable(error, model)) break
      }
    }
    return { ok: false, route, attempts, error: lastError }
  }
}
