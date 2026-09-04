import { AuditOutcome } from '../../reliability/audit-reversible.js'
import { VisualQaStatus } from './visual-qa.js'

const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)

export const ChangeKind = Object.freeze({ CODE: 'CODE', OPERATION: 'OPERATION' })
export const ChangeReceiptStatus = Object.freeze({ CERTIFIED: 'CERTIFIED', BLOCKED: 'BLOCKED' })
export const ChangeEvidenceStatus = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', UNKNOWN: 'UNKNOWN' })

function normalizeCommit(value, label) {
  if (!value) return null
  const sha = text(value.sha || value)
  if (!/^[a-f0-9]{7,64}$/i.test(sha)) throw new TypeError(`change receipt ${label} commit sha is invalid`)
  return freeze({ sha, ref: text(value.ref) || null })
}

function normalizeFiles(files = []) {
  if (!Array.isArray(files)) throw new TypeError('change receipt files must be an array')
  const allowed = new Set(['ADDED', 'MODIFIED', 'DELETED', 'RENAMED'])
  return freeze(files.map((item) => {
    const path = text(item?.path)
    const status = text(item?.status).toUpperCase()
    if (!path || !allowed.has(status)) throw new TypeError('change receipt file requires path and valid status')
    return freeze({ path, status, previousPath: text(item?.previousPath) || null })
  }))
}

function normalizeDependencies(items = []) {
  if (!Array.isArray(items)) throw new TypeError('change receipt dependencies must be an array')
  return freeze(items.map((item) => {
    const name = text(item?.name)
    const action = text(item?.action).toUpperCase()
    if (!name || !['ADDED', 'REMOVED', 'UPDATED', 'UNCHANGED'].includes(action)) throw new TypeError('dependency change requires name and valid action')
    return freeze({ name, action, before: text(item?.before) || null, after: text(item?.after) || null })
  }))
}

function normalizeChecks(items = [], label = 'test') {
  if (!Array.isArray(items)) throw new TypeError(`change receipt ${label}s must be an array`)
  return freeze(items.map((item) => {
    const name = text(item?.name)
    const status = text(item?.status).toUpperCase()
    const evidenceId = text(item?.evidenceId || item?.artifactId)
    if (!name || !Object.values(ChangeEvidenceStatus).includes(status)) throw new TypeError(`${label} requires name and valid status`)
    if (status === ChangeEvidenceStatus.PASS && !evidenceId) throw new TypeError(`passing ${label} requires evidenceId`)
    return freeze({ name, status, evidenceId: evidenceId || null, details: text(item?.details) || null })
  }))
}

function normalizeVisuals(items = []) {
  if (!Array.isArray(items)) throw new TypeError('change receipt visuals must be an array')
  return freeze(items.map((item) => {
    if (!item || !Object.values(VisualQaStatus).includes(item.status)) throw new TypeError('change receipt visual QA result is invalid')
    return freeze({ ...item })
  }))
}

function normalizeRollback(value = {}) {
  const available = value?.available === true
  return freeze({
    available,
    strategy: text(value?.strategy) || null,
    reference: text(value?.reference) || null,
    verified: value?.verified === true,
  })
}

export function createRandChangeReceipt({
  id,
  kind = ChangeKind.CODE,
  hotelId,
  actorId,
  operationId = null,
  beforeCommit = null,
  afterCommit = null,
  files = [],
  dependencies = [],
  tests = [],
  gates = [],
  visuals = [],
  auditRecord = null,
  rollback = {},
  sourceIds = [],
  createdAt = new Date().toISOString(),
  metadata = {},
} = {}) {
  const normalizedKind = text(kind).toUpperCase()
  if (!Object.values(ChangeKind).includes(normalizedKind)) throw new TypeError('change receipt kind is invalid')
  const receiptId = text(id)
  const scopeHotel = text(hotelId)
  const actor = text(actorId)
  if (!receiptId || !scopeHotel || !actor) throw new TypeError('change receipt id, hotelId and actorId are required')
  if (Number.isNaN(Date.parse(createdAt))) throw new TypeError('change receipt createdAt must be a valid ISO date')

  const before = normalizeCommit(beforeCommit, 'before')
  const after = normalizeCommit(afterCommit, 'after')
  const normalizedFiles = normalizeFiles(files)
  const normalizedDependencies = normalizeDependencies(dependencies)
  const normalizedTests = normalizeChecks(tests, 'test')
  const normalizedGates = normalizeChecks(gates, 'gate')
  const normalizedVisuals = normalizeVisuals(visuals)
  const normalizedRollback = normalizeRollback(rollback)
  const provenance = freeze([...new Set((sourceIds || []).map(text).filter(Boolean))])
  const reasons = []

  if (!provenance.length) reasons.push('MISSING_PROVENANCE')
  if (normalizedKind === ChangeKind.CODE) {
    if (!before || !after) reasons.push('CODE_CHANGE_REQUIRES_BEFORE_AFTER_COMMITS')
    if (before && after && before.sha === after.sha) reasons.push('CODE_CHANGE_COMMITS_ARE_IDENTICAL')
  }
  if (normalizedKind === ChangeKind.OPERATION) {
    if (!auditRecord) reasons.push('OPERATION_CHANGE_REQUIRES_AUDIT')
    else {
      if (text(auditRecord.hotelId) !== scopeHotel) reasons.push('AUDIT_SCOPE_MISMATCH')
      if (auditRecord.outcome !== AuditOutcome.SUCCEEDED || auditRecord.verified !== true) reasons.push('AUDIT_NOT_VERIFIED_SUCCESS')
      if (operationId && text(auditRecord.operationId) !== text(operationId)) reasons.push('AUDIT_OPERATION_MISMATCH')
    }
  }
  if (normalizedTests.length === 0) reasons.push('MISSING_TEST_EVIDENCE')
  if (normalizedTests.some((item) => item.status !== ChangeEvidenceStatus.PASS)) reasons.push('TEST_GATE_NOT_PASSING')
  if (normalizedGates.length === 0) reasons.push('MISSING_QUALITY_GATES')
  if (normalizedGates.some((item) => item.status !== ChangeEvidenceStatus.PASS)) reasons.push('QUALITY_GATE_NOT_PASSING')
  if (normalizedVisuals.some((item) => item.hotelId !== scopeHotel)) reasons.push('VISUAL_SCOPE_MISMATCH')
  if (normalizedVisuals.some((item) => item.status !== VisualQaStatus.PASS)) reasons.push('VISUAL_QA_NOT_PASSING')

  const mutating = normalizedKind === ChangeKind.OPERATION || normalizedFiles.length > 0 || normalizedDependencies.some((item) => item.action !== 'UNCHANGED')
  if (mutating && (!normalizedRollback.available || !normalizedRollback.strategy || !normalizedRollback.reference)) reasons.push('ROLLBACK_NOT_DECLARED')

  const status = reasons.length ? ChangeReceiptStatus.BLOCKED : ChangeReceiptStatus.CERTIFIED
  return freeze({
    version: 1,
    id: receiptId,
    kind: normalizedKind,
    status,
    certified: status === ChangeReceiptStatus.CERTIFIED,
    hotelId: scopeHotel,
    actorId: actor,
    operationId: text(operationId) || null,
    commits: freeze({ before, after }),
    changes: freeze({ files: normalizedFiles, dependencies: normalizedDependencies }),
    evidence: freeze({ tests: normalizedTests, gates: normalizedGates, visuals: normalizedVisuals, sourceIds: provenance }),
    audit: auditRecord ? freeze({ operationId: text(auditRecord.operationId), outcome: auditRecord.outcome, verified: auditRecord.verified === true }) : null,
    rollback: normalizedRollback,
    createdAt,
    metadata: freeze({ ...(metadata || {}) }),
    reasons: freeze(reasons),
  })
}

export function assertCertifiedChangeReceipt(receipt) {
  if (!receipt?.certified) {
    const error = new Error(`RAND_CHANGE_RECEIPT_BLOCKED:${(receipt?.reasons || []).join(',')}`)
    error.code = 'RAND_CHANGE_RECEIPT_BLOCKED'
    error.reasons = receipt?.reasons || []
    throw error
  }
  return receipt
}
