export const HealthStatus = Object.freeze({ HEALTHY:'HEALTHY', DEGRADED:'DEGRADED', CRITICAL:'CRITICAL', UNKNOWN:'UNKNOWN' })
export const FindingSeverity = Object.freeze({ INFO:'INFO', WARN:'WARN', HIGH:'HIGH', CRITICAL:'CRITICAL' })

const RANK = Object.freeze({ INFO:0, WARN:1, HIGH:2, CRITICAL:3 })
const STATUS_RANK = Object.freeze({ HEALTHY:0, UNKNOWN:1, DEGRADED:2, CRITICAL:3 })
const clampScore = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0))

export function normalizeHealthCheck(check = {}) {
  const status = Object.values(HealthStatus).includes(check.status) ? check.status : HealthStatus.UNKNOWN
  const findings = Array.isArray(check.findings) ? check.findings.map((item) => ({ ...item, severity: Object.values(FindingSeverity).includes(item?.severity) ? item.severity : FindingSeverity.INFO })) : []
  return Object.freeze({ ...check, status, score: clampScore(check.score), findings })
}

export function compareHealthChecks(current, previous) {
  const now = normalizeHealthCheck(current)
  if (!previous) return Object.freeze({ direction:'BASELINE', scoreDelta:null, newFindings:now.findings, resolvedFindings:[], worsened:false })
  const before = normalizeHealthCheck(previous)
  const fingerprint = (item) => String(item?.fingerprint || item?.code || item?.title || '')
  const prevMap = new Map(before.findings.map((item) => [fingerprint(item), item]))
  const nowMap = new Map(now.findings.map((item) => [fingerprint(item), item]))
  const newFindings = now.findings.filter((item) => !prevMap.has(fingerprint(item)))
  const resolvedFindings = before.findings.filter((item) => !nowMap.has(fingerprint(item)))
  const severityWorsened = now.findings.some((item) => {
    const old = prevMap.get(fingerprint(item))
    return old && (RANK[item.severity] ?? 0) > (RANK[old.severity] ?? 0)
  })
  const scoreDelta = Number((now.score - before.score).toFixed(2))
  const worsened = scoreDelta < 0 || severityWorsened || STATUS_RANK[now.status] > STATUS_RANK[before.status]
  const direction = worsened ? 'WORSE' : scoreDelta > 0 || resolvedFindings.length ? 'BETTER' : 'STABLE'
  return Object.freeze({ direction, scoreDelta, newFindings, resolvedFindings, worsened })
}

export function summarizeHealthHistory(checks = []) {
  const normalized = checks.map(normalizeHealthCheck)
  const latest = normalized[0] || null
  const previous = normalized[1] || null
  const drift = latest ? compareHealthChecks(latest, previous) : null
  return Object.freeze({ latest, previous, drift, total: normalized.length, critical: normalized.filter((item) => item.status === HealthStatus.CRITICAL).length, degraded: normalized.filter((item) => item.status === HealthStatus.DEGRADED).length })
}
