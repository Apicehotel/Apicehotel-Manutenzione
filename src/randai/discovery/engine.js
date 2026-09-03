import { DiscoveryDecision, DiscoveryStatus, classifyDiscoveryDisposition, validateDiscoveryCandidate } from './contracts.js'
import { DiscoveryStore } from './store.js'

const clone = (value) => structuredClone(value)
const RISK_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const nowIso = () => new Date().toISOString()

function boundedScore(value, name) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) throw new TypeError(`${name} must be a finite number between 0 and 1`)
  return numeric
}

function normalize(raw, source, projectId) {
  const item = {
    projectId,
    status: DiscoveryStatus.DISCOVERED,
    risk: raw.risk || 'MEDIUM',
    score: 0,
    permissions: [...(raw.permissions || [])],
    dependencies: [...(raw.dependencies || [])],
    license: raw.license || null,
    reputation: Number(raw.reputation || 0),
    maintained: raw.maintained !== false,
    analysis: null,
    sandbox: null,
    evaluation: null,
    source: { id: source.id, ref: raw.source?.ref || raw.ref },
    discoveredAt: nowIso(), updatedAt: nowIso(),
    ...clone(raw),
  }
  item.source = { id: source.id, ref: raw.source?.ref || raw.ref }
  validateDiscoveryCandidate(item)
  if (!RISK_ORDER.includes(item.risk)) throw new TypeError(`Invalid discovery risk: ${item.risk}`)
  item.reputation = boundedScore(item.reputation, 'reputation')
  return item
}

export class DiscoveryEngine {
  constructor({ sources = [], store = new DiscoveryStore(), analyzer = null, sandbox = null, evaluator = null, allowedLicenses = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'], maxRisk = 'HIGH' } = {}) {
    if (!Array.isArray(allowedLicenses) || allowedLicenses.some((item) => !String(item || '').trim())) throw new TypeError('allowedLicenses must contain non-empty licenses')
    if (!RISK_ORDER.includes(maxRisk)) throw new TypeError(`Invalid maxRisk: ${maxRisk}`)
    this.sources = new Map()
    for (const source of sources) this.registerSource(source)
    this.store = store; this.analyzer = analyzer; this.sandbox = sandbox; this.evaluator = evaluator
    this.allowedLicenses = new Set(allowedLicenses); this.maxRisk = maxRisk
    this.lastSourceFailures = []
  }

  registerSource(source) {
    if (!source?.id || typeof source.search !== 'function') throw new TypeError('Discovery source requires id and search()')
    if (this.sources.has(source.id)) throw new Error(`Discovery source already registered: ${source.id}`)
    this.sources.set(source.id, source)
    return source.id
  }

  async discover({ query, projectId = 'randai', kind = null } = {}) {
    if (!String(query || '').trim()) throw new TypeError('query is required')
    const found = []
    const failures = []
    const seenIds = new Map()
    for (const source of this.sources.values()) {
      let results
      try {
        results = await source.search({ query: query.trim(), kind, projectId })
      } catch (error) {
        failures.push({ sourceId: source.id, message: error?.message || String(error) })
        continue
      }
      if (!Array.isArray(results)) throw new TypeError(`Discovery source ${source.id} must return an array`)
      for (const raw of results) {
        const item = normalize(raw, source, projectId)
        const previousSource = seenIds.get(item.id)
        if (previousSource) throw new Error(`Duplicate discovery candidate id ${item.id} from ${previousSource} and ${source.id}`)
        seenIds.set(item.id, source.id)
        await this.store.save(item); found.push(item)
      }
    }
    this.lastSourceFailures = failures
    if (!found.length && failures.length === this.sources.size && failures.length > 0) {
      throw new AggregateError(failures.map((item) => new Error(`${item.sourceId}: ${item.message}`)), 'All discovery sources failed')
    }
    return found.sort((a, b) => b.reputation - a.reputation)
  }

  async assess(id, { projectId = 'randai' } = {}) {
    const item = await this.#require(id, projectId)
    const analysis = this.analyzer ? await this.analyzer(clone(item)) : {}
    item.analysis = clone(analysis || {})
    if (analysis?.risk) {
      if (!RISK_ORDER.includes(analysis.risk)) throw new TypeError(`Invalid analyzed discovery risk: ${analysis.risk}`)
      item.risk = analysis.risk
    }
    const licenseOk = Boolean(item.license && this.allowedLicenses.has(item.license))
    const riskOk = RISK_ORDER.indexOf(item.risk) <= RISK_ORDER.indexOf(this.maxRisk)
    const suspicious = Boolean(analysis?.suspicious || analysis?.secretAccess || analysis?.unboundedNetwork)
    item.score = Math.max(0, Math.min(1, (item.reputation * 0.25) + (item.maintained ? 0.15 : 0) + (licenseOk ? 0.2 : 0) + (riskOk ? 0.2 : 0) + (!suspicious ? 0.2 : 0)))
    item.status = (!licenseOk || !riskOk || suspicious) ? DiscoveryStatus.REJECTED : DiscoveryStatus.ANALYZED
    item.updatedAt = nowIso(); await this.store.save(item)
    return { candidate: clone(item), decision: item.status === DiscoveryStatus.REJECTED ? DiscoveryDecision.REJECT : DiscoveryDecision.SANDBOX }
  }

  async sandboxCandidate(id, { projectId = 'randai' } = {}) {
    const item = await this.#require(id, projectId)
    if (item.status !== DiscoveryStatus.ANALYZED) throw new Error(`Candidate must be ANALYZED before sandbox: ${item.status}`)
    if (typeof this.sandbox !== 'function') throw new Error('Sandbox runner is not configured')
    item.sandbox = clone(await this.sandbox(clone(item)))
    if (item.sandbox?.passed !== true) item.status = DiscoveryStatus.REJECTED
    else item.status = DiscoveryStatus.SANDBOXED
    item.updatedAt = nowIso(); await this.store.save(item); return clone(item)
  }

  async evaluateCandidate(id, { projectId = 'randai', existingCandidates = [] } = {}) {
    const item = await this.#require(id, projectId)
    if (item.status !== DiscoveryStatus.SANDBOXED) throw new Error(`Candidate must be SANDBOXED before evaluation: ${item.status}`)
    if (typeof this.evaluator !== 'function') throw new Error('Discovery evaluator is not configured')
    item.evaluation = clone(await this.evaluator(clone(item)))
    const utility = boundedScore(item.evaluation?.utilityScore, 'utilityScore')
    const security = boundedScore(item.evaluation?.securityScore, 'securityScore')
    item.score = Math.max(0, Math.min(1, item.score * 0.4 + utility * 0.3 + security * 0.3))
    item.status = utility >= 0.75 && security >= 0.9 ? DiscoveryStatus.RECOMMENDED : DiscoveryStatus.REJECTED
    item.disposition = classifyDiscoveryDisposition({ candidate: item, existingCandidates })
    item.updatedAt = nowIso(); await this.store.save(item); return clone(item)
  }

  async recommendations(filters = {}) { return (await this.store.list({ ...filters, status: DiscoveryStatus.RECOMMENDED })).sort((a, b) => b.score - a.score) }

  async #require(id, projectId) { const item = await this.store.get(id, projectId); if (!item) throw new Error(`Unknown discovery candidate: ${projectId}/${id}`); return item }
}
