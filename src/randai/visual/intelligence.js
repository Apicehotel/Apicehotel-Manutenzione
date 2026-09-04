import { coerceHealthEvidenceSnapshot, RANDCORE_HEALTH_DOMAINS } from '../core/health-evidence.js'
import { ToolPermission, ToolRisk, toolSuccess } from '../tools/contracts.js'
import { RandVisualDiagramType, RandVisualDirection, normalizeRandVisualSpec } from './contracts.js'
import { RandVisualEngine } from './engine.js'

const clone = (value) => value == null ? value : structuredClone(value)
const text = (value) => String(value ?? '').trim()
const unique = (values = []) => [...new Set(values.map(text).filter(Boolean))]

export const RandCoreVisualView = Object.freeze({
  HEALTH: 'health',
  WORKERS: 'workers',
  PERMISSIONS: 'permissions',
  DEPLOYMENT: 'deployment',
  DATABASE: 'database',
  REPO_IMPACT: 'repo_impact',
})

const VIEW_SET = new Set(Object.values(RandCoreVisualView))

export class RandCoreVisualEvidenceError extends Error {
  constructor(message, code = 'RANDCORE_VISUAL_EVIDENCE_INVALID') {
    super(message)
    this.name = 'RandCoreVisualEvidenceError'
    this.code = code
  }
}

function requireHotelId(hotelId) {
  const value = text(hotelId)
  if (!value) throw new RandCoreVisualEvidenceError('RandCore visual intelligence requires hotelId', 'RANDCORE_VISUAL_HOTEL_REQUIRED')
  return value
}

function requireSources(sourceIds, view) {
  const sources = unique(sourceIds)
  if (!sources.length) throw new RandCoreVisualEvidenceError(`RandCore visual ${view} requires provenance sourceIds`, 'RANDCORE_VISUAL_PROVENANCE_REQUIRED')
  return sources
}

function sourceIdsFromHealth(snapshot) {
  const values = Object.values(snapshot?.domains || {})
  const ids = []
  for (const item of values) {
    if (item?.source) ids.push(`health:${item.domain}:${item.source}`)
    const evidenceId = item?.evidence?.evidence_id || item?.evidence?.id
    if (evidenceId) ids.push(`evidence:${evidenceId}`)
    const commit = item?.evidence?.commit_sha
    if (commit) ids.push(`commit:${commit}`)
  }
  return unique(ids)
}

function statusKind(status, state) {
  const s = text(status).toUpperCase()
  const e = text(state).toUpperCase()
  if (s === 'CRITICAL' || s === 'BLOCKED') return 'critical'
  if (s === 'DEGRADED' || e === 'STALE') return 'warning'
  if (s === 'HEALTHY' && e === 'VERIFIED') return 'healthy'
  return 'unknown'
}

export function buildHealthVisualSpec({ hotelId, snapshot, sourceIds = [], title = 'RandCore Health Map' } = {}) {
  const scopedHotelId = requireHotelId(hotelId)
  const normalized = coerceHealthEvidenceSnapshot(snapshot || {})
  const nodes = [
    {
      id: 'randcore',
      label: `RandCore · ${normalized.status}\nScore ${normalized.score}/100 · Confidence ${normalized.confidence}%`,
      layer: 0,
      emphasis: true,
      kind: statusKind(normalized.status, normalized.coverage?.verified_domains === RANDCORE_HEALTH_DOMAINS.length ? 'VERIFIED' : 'UNKNOWN'),
    },
    ...RANDCORE_HEALTH_DOMAINS.map((domain) => {
      const evidence = normalized.domains[domain] || {}
      const score = evidence.score == null ? '—' : `${evidence.score}/100`
      return {
        id: `domain:${domain}`,
        label: `${domain}\n${evidence.state || 'UNKNOWN'} · ${evidence.status || 'UNKNOWN'}\nScore ${score}`,
        layer: 1,
        kind: statusKind(evidence.status, evidence.state),
        metadata: { checkedAt: evidence.checkedAt || null, source: evidence.source || null },
      }
    }),
  ]
  const edges = RANDCORE_HEALTH_DOMAINS.map((domain) => ({ from: 'randcore', to: `domain:${domain}`, label: 'evidence' }))
  return normalizeRandVisualSpec({
    type: RandVisualDiagramType.ARCHITECTURE,
    direction: RandVisualDirection.TB,
    title,
    hotelId: scopedHotelId,
    nodes,
    edges,
    sourceIds: requireSources([...sourceIdsFromHealth(normalized), ...sourceIds], RandCoreVisualView.HEALTH),
    metadata: {
      view: RandCoreVisualView.HEALTH,
      contractVersion: normalized.version,
      generatedAt: normalized.generated_at,
      evaluatedAt: normalized.evaluated_at,
      verifiedDomains: normalized.coverage?.verified_domains ?? 0,
      totalDomains: normalized.coverage?.total_domains ?? RANDCORE_HEALTH_DOMAINS.length,
    },
  })
}

export function buildWorkerVisualSpec({ hotelId, snapshot = {}, sourceIds = [], title = 'RandCore Worker Map' } = {}) {
  const scopedHotelId = requireHotelId(hotelId)
  const workers = Array.isArray(snapshot.workers) ? snapshot.workers : []
  if (!workers.length) throw new RandCoreVisualEvidenceError('Worker visual requires at least one worker snapshot')
  const nodes = [{ id: 'scheduler', label: 'RandCore Scheduler', layer: 0, emphasis: true, kind: 'default' }]
  const edges = []
  for (const worker of workers) {
    const id = `worker:${text(worker.id || worker.name)}`
    if (id === 'worker:') throw new RandCoreVisualEvidenceError('Worker snapshot requires id or name')
    nodes.push({
      id,
      label: `${text(worker.name || worker.id)}\n${text(worker.status || 'UNKNOWN').toUpperCase()}${worker.schedule ? ` · ${text(worker.schedule)}` : ''}`,
      layer: 1,
      kind: statusKind(worker.status, worker.state),
      metadata: { lastRunAt: worker.lastRunAt || worker.last_run_at || null },
    })
    edges.push({ from: 'scheduler', to: id, label: worker.trigger || 'scheduled' })
  }
  return normalizeRandVisualSpec({
    type: RandVisualDiagramType.WORKER,
    direction: RandVisualDirection.LR,
    title,
    hotelId: scopedHotelId,
    nodes,
    edges,
    sourceIds: requireSources([...sourceIds, ...(snapshot.sourceIds || [])], RandCoreVisualView.WORKERS),
    metadata: { view: RandCoreVisualView.WORKERS, generatedAt: snapshot.generatedAt || snapshot.generated_at || null },
  })
}

export function buildPermissionVisualSpec({ hotelId, snapshot = {}, sourceIds = [], title = 'RandCore Permission Matrix' } = {}) {
  const scopedHotelId = requireHotelId(hotelId)
  const cases = Array.isArray(snapshot.cases) ? snapshot.cases : []
  if (!cases.length) throw new RandCoreVisualEvidenceError('Permission visual requires authorization matrix cases')
  const resultById = new Map((snapshot.results || []).map((item) => [text(item.id), item]))
  const nodes = []
  const edges = []
  const roles = new Set()
  const capabilities = new Set()
  for (const item of cases) {
    if (text(item.hotelId) && text(item.hotelId) !== scopedHotelId) throw new RandCoreVisualEvidenceError('Permission case crosses hotel scope', 'RANDCORE_VISUAL_SCOPE_DENIED')
    const roleId = `role:${text(item.actorRole)}`
    const capId = `cap:${text(item.module)}:${text(item.action)}`
    if (!text(item.actorRole) || !text(item.module) || !text(item.action)) throw new RandCoreVisualEvidenceError('Permission case requires actorRole, module and action')
    if (!roles.has(roleId)) { roles.add(roleId); nodes.push({ id: roleId, label: text(item.actorRole), layer: 0, kind: 'role' }) }
    if (!capabilities.has(capId)) { capabilities.add(capId); nodes.push({ id: capId, label: `${text(item.module)} · ${text(item.action)}`, layer: 1, kind: 'capability' }) }
    const observed = resultById.get(text(item.id))
    const expected = text(item.expected || 'DENY').toUpperCase()
    const actual = text(observed?.actual || expected).toUpperCase()
    edges.push({ from: roleId, to: capId, label: `${expected}${observed ? ` / ${actual}` : ''}`, kind: observed?.ok === false ? 'mismatch' : expected === 'ALLOW' ? 'allow' : 'deny' })
  }
  return normalizeRandVisualSpec({
    type: RandVisualDiagramType.PERMISSION_MATRIX,
    direction: RandVisualDirection.LR,
    title,
    hotelId: scopedHotelId,
    nodes,
    edges,
    sourceIds: requireSources([...sourceIds, ...(snapshot.sourceIds || [])], RandCoreVisualView.PERMISSIONS),
    metadata: { view: RandCoreVisualView.PERMISSIONS, verified: Array.isArray(snapshot.results), failures: (snapshot.results || []).filter((item) => item?.ok === false).length },
  })
}

export function buildDeploymentVisualSpec({ hotelId, snapshot = {}, sourceIds = [], title = 'RandCore Deployment Map' } = {}) {
  const scopedHotelId = requireHotelId(hotelId)
  const services = Array.isArray(snapshot.services) ? snapshot.services : []
  if (!services.length) throw new RandCoreVisualEvidenceError('Deployment visual requires services')
  const ids = new Set(services.map((service) => text(service.id)))
  if (ids.has('')) throw new RandCoreVisualEvidenceError('Deployment service requires id')
  const nodes = services.map((service, index) => ({
    id: `service:${text(service.id)}`,
    label: `${text(service.name || service.id)}${service.environment ? `\n${text(service.environment)}` : ''}${service.commitSha ? ` · ${text(service.commitSha).slice(0,8)}` : ''}`,
    layer: Number.isInteger(service.layer) ? service.layer : index === 0 ? 0 : 1,
    kind: statusKind(service.status, service.state),
  }))
  const edges = []
  for (const service of services) for (const dep of service.dependsOn || []) {
    if (!ids.has(text(dep))) throw new RandCoreVisualEvidenceError(`Deployment dependency references unknown service: ${dep}`)
    edges.push({ from: `service:${text(dep)}`, to: `service:${text(service.id)}`, label: 'deploys' })
  }
  return normalizeRandVisualSpec({
    type: RandVisualDiagramType.DEPLOYMENT,
    direction: RandVisualDirection.LR,
    title,
    hotelId: scopedHotelId,
    nodes,
    edges,
    sourceIds: requireSources([...sourceIds, ...(snapshot.sourceIds || [])], RandCoreVisualView.DEPLOYMENT),
    metadata: { view: RandCoreVisualView.DEPLOYMENT, commitSha: snapshot.commitSha || snapshot.commit_sha || null },
  })
}

export function buildDatabaseVisualSpec({ hotelId, snapshot = {}, sourceIds = [], title = 'RandCore Database Map' } = {}) {
  const scopedHotelId = requireHotelId(hotelId)
  const tables = Array.isArray(snapshot.tables) ? snapshot.tables : []
  if (!tables.length) throw new RandCoreVisualEvidenceError('Database visual requires tables')
  const tableIds = new Set(tables.map((table) => text(table.name || table.id)))
  if (tableIds.has('')) throw new RandCoreVisualEvidenceError('Database table requires name or id')
  const nodes = tables.map((table) => {
    const name = text(table.name || table.id)
    const columns = (table.columns || []).slice(0, 8).map((column) => text(column.name || column)).filter(Boolean)
    return { id: `table:${name}`, label: `${name}${columns.length ? `\n${columns.join(' · ')}` : ''}`, layer: Number(table.layer || 0), kind: 'table' }
  })
  const edges = []
  for (const table of tables) {
    const from = text(table.name || table.id)
    for (const fk of table.foreignKeys || table.foreign_keys || []) {
      const target = text(fk.referencesTable || fk.references_table || fk.to)
      if (!tableIds.has(target)) throw new RandCoreVisualEvidenceError(`Foreign key references unknown table: ${target}`)
      edges.push({ from: `table:${from}`, to: `table:${target}`, label: text(fk.label || fk.column || 'FK') })
    }
  }
  return normalizeRandVisualSpec({
    type: RandVisualDiagramType.DATABASE,
    direction: RandVisualDirection.LR,
    title,
    hotelId: scopedHotelId,
    nodes,
    edges,
    sourceIds: requireSources([...sourceIds, ...(snapshot.sourceIds || [])], RandCoreVisualView.DATABASE),
    metadata: { view: RandCoreVisualView.DATABASE, schema: snapshot.schema || 'public' },
  })
}

export function buildRepoImpactVisualSpec({ hotelId, snapshot = {}, sourceIds = [], title = 'Repo Radar Impact Map' } = {}) {
  const scopedHotelId = requireHotelId(hotelId)
  const candidate = snapshot.candidate || {}
  const candidateId = text(candidate.id || candidate.name || candidate.repository)
  if (!candidateId) throw new RandCoreVisualEvidenceError('Repo impact visual requires candidate repository')
  const modules = Array.isArray(snapshot.affectedModules) ? snapshot.affectedModules : []
  const dependencies = Array.isArray(snapshot.dependencies) ? snapshot.dependencies : []
  const nodes = [{ id: 'candidate', label: `${candidateId}\n${text(snapshot.decision || candidate.decision || 'EVALUATE').toUpperCase()}`, layer: 0, emphasis: true, kind: text(snapshot.decision || '').toLowerCase() }]
  const edges = []
  for (const module of modules) {
    const id = `module:${text(module.id || module.name)}`
    if (id === 'module:') throw new RandCoreVisualEvidenceError('Affected module requires id or name')
    nodes.push({ id, label: text(module.name || module.id), layer: 1, kind: text(module.impact || 'affected').toLowerCase() })
    edges.push({ from: 'candidate', to: id, label: text(module.change || module.impact || 'affects') })
  }
  for (const dep of dependencies) {
    const id = `dependency:${text(dep.id || dep.name)}`
    if (id === 'dependency:') throw new RandCoreVisualEvidenceError('Dependency requires id or name')
    nodes.push({ id, label: text(dep.name || dep.id), layer: 2, kind: text(dep.risk || 'dependency').toLowerCase() })
    const parent = dep.moduleId && modules.some((module) => text(module.id || module.name) === text(dep.moduleId)) ? `module:${text(dep.moduleId)}` : 'candidate'
    edges.push({ from: parent, to: id, label: text(dep.change || 'dependency') })
  }
  return normalizeRandVisualSpec({
    type: RandVisualDiagramType.DEPENDENCY,
    direction: RandVisualDirection.LR,
    title,
    hotelId: scopedHotelId,
    nodes,
    edges,
    sourceIds: requireSources([...sourceIds, ...(snapshot.sourceIds || [])], RandCoreVisualView.REPO_IMPACT),
    metadata: { view: RandCoreVisualView.REPO_IMPACT, decision: snapshot.decision || candidate.decision || null, candidate: candidateId },
  })
}

const BUILDERS = Object.freeze({
  [RandCoreVisualView.HEALTH]: buildHealthVisualSpec,
  [RandCoreVisualView.WORKERS]: buildWorkerVisualSpec,
  [RandCoreVisualView.PERMISSIONS]: buildPermissionVisualSpec,
  [RandCoreVisualView.DEPLOYMENT]: buildDeploymentVisualSpec,
  [RandCoreVisualView.DATABASE]: buildDatabaseVisualSpec,
  [RandCoreVisualView.REPO_IMPACT]: buildRepoImpactVisualSpec,
})

export class RandCoreVisualIntelligence {
  constructor({ engine = new RandVisualEngine() } = {}) {
    if (!engine || typeof engine.render !== 'function') throw new TypeError('RandCoreVisualIntelligence requires RandVisualEngine-compatible render()')
    this.engine = engine
  }

  build(view, input = {}) {
    if (!VIEW_SET.has(view)) throw new TypeError(`Unknown RandCore visual view: ${view}`)
    return BUILDERS[view](input)
  }

  render(view, input = {}, { context = {} } = {}) {
    const spec = this.build(view, input)
    return { spec: clone(spec), ...this.engine.render(spec, { context }) }
  }
}

export function createRandCoreVisualIntelligenceTool(intelligence = new RandCoreVisualIntelligence()) {
  if (!intelligence || typeof intelligence.render !== 'function') throw new TypeError('Visual intelligence tool requires render()')
  return {
    id: 'randvisual.intelligence',
    name: 'RandCore Visual Intelligence',
    description: 'Transform authorized RandCore evidence snapshots into provenance-backed RandVisual diagrams.',
    risk: ToolRisk.LOW,
    permission: ToolPermission.READ,
    idempotent: true,
    timeoutMs: 5000,
    retryPolicy: { maxAttempts: 1, delayMs: 0 },
    execute: async ({ view, input } = {}, context = {}) => toolSuccess(intelligence.render(view, input, { context }), { engine: 'randvisual', intelligence: 'randcore', version: 1 }),
  }
}
