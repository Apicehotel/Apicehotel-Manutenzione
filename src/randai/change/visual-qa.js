const text = (value) => String(value ?? '').trim()
const freeze = (value) => Object.freeze(value)

export const VisualQaStatus = Object.freeze({ PASS: 'PASS', BLOCKED: 'BLOCKED' })
export const VisualQaEvidenceStatus = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', UNKNOWN: 'UNKNOWN' })

const REQUIRED_ENGINES = Object.freeze(['chromium', 'webkit'])

function normalizeArtifact(value, label) {
  if (!value?.manifest || typeof value.manifest !== 'object') throw new TypeError(`VisualQA ${label} manifest is required`)
  const manifest = value.manifest
  const hotelId = text(manifest.hotelId)
  const fingerprint = text(manifest.fingerprint)
  if (!hotelId) throw new TypeError(`VisualQA ${label} hotelId is required`)
  if (!fingerprint) throw new TypeError(`VisualQA ${label} fingerprint is required`)
  if (!Array.isArray(manifest.sourceIds) || manifest.sourceIds.length === 0 || manifest.sourceIds.some((id) => !text(id))) {
    throw new TypeError(`VisualQA ${label} provenance sourceIds are required`)
  }
  return freeze({
    hotelId,
    fingerprint,
    diagramType: text(manifest.diagramType) || null,
    width: Number(manifest.width) || 0,
    height: Number(manifest.height) || 0,
    sourceIds: freeze([...new Set(manifest.sourceIds.map(text))]),
  })
}

function normalizeEvidence(items = []) {
  if (!Array.isArray(items)) throw new TypeError('VisualQA renderEvidence must be an array')
  return freeze(items.map((item) => {
    const engine = text(item?.engine).toLowerCase()
    const status = text(item?.status).toUpperCase()
    const evidenceId = text(item?.evidenceId || item?.artifactId)
    if (!engine || !Object.values(VisualQaEvidenceStatus).includes(status)) throw new TypeError('VisualQA evidence requires engine and valid status')
    if (status === VisualQaEvidenceStatus.PASS && !evidenceId) throw new TypeError('VisualQA passing evidence requires evidenceId')
    return freeze({ engine, status, evidenceId: evidenceId || null, viewport: text(item?.viewport) || null })
  }))
}

export function evaluateVisualQa({
  before,
  after,
  expectedChange = true,
  renderEvidence = [],
  requireBrowserEvidence = true,
} = {}) {
  const previous = normalizeArtifact(before, 'before')
  const current = normalizeArtifact(after, 'after')
  if (previous.hotelId !== current.hotelId) {
    const error = new Error(`VISUAL_QA_SCOPE_MISMATCH:${previous.hotelId}:${current.hotelId}`)
    error.code = 'VISUAL_QA_SCOPE_MISMATCH'
    throw error
  }
  if (previous.diagramType && current.diagramType && previous.diagramType !== current.diagramType) {
    throw new TypeError('VisualQA before/after diagramType mismatch')
  }

  const evidence = normalizeEvidence(renderEvidence)
  const changed = previous.fingerprint !== current.fingerprint
  const reasons = []
  if (expectedChange && !changed) reasons.push('EXPECTED_VISUAL_CHANGE_NOT_DETECTED')
  if (!expectedChange && changed) reasons.push('UNEXPECTED_VISUAL_CHANGE_DETECTED')
  if (current.width <= 0 || current.height <= 0) reasons.push('INVALID_RENDER_DIMENSIONS')

  if (requireBrowserEvidence) {
    for (const engine of REQUIRED_ENGINES) {
      const matches = evidence.filter((item) => item.engine === engine)
      if (!matches.length) reasons.push(`MISSING_${engine.toUpperCase()}_EVIDENCE`)
      else if (!matches.some((item) => item.status === VisualQaEvidenceStatus.PASS)) reasons.push(`${engine.toUpperCase()}_VISUAL_GATE_NOT_PASSING`)
    }
  }
  if (evidence.some((item) => item.status === VisualQaEvidenceStatus.FAIL)) reasons.push('VISUAL_GATE_FAILURE')

  const status = reasons.length ? VisualQaStatus.BLOCKED : VisualQaStatus.PASS
  return freeze({
    version: 1,
    status,
    passed: status === VisualQaStatus.PASS,
    hotelId: current.hotelId,
    diagramType: current.diagramType,
    expectedChange: expectedChange === true,
    changed,
    beforeFingerprint: previous.fingerprint,
    afterFingerprint: current.fingerprint,
    sourceIds: freeze([...new Set([...previous.sourceIds, ...current.sourceIds])]),
    renderEvidence: evidence,
    reasons: freeze(reasons),
  })
}
