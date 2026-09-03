import { TraceStatus, SpanStatus } from './contracts.js'

const clone = (value) => value == null ? value : structuredClone(value)
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const hotelOf = (trace) => trace?.hotelId || trace?.metadata?.hotelId || trace?.metadata?.hotel_id || null
const durationOf = (trace) => {
  if (trace?.durationMs != null) return Math.max(0, finite(trace.durationMs))
  if (trace?.endedAt && trace?.startedAt) return Math.max(0, new Date(trace.endedAt).getTime() - new Date(trace.startedAt).getTime())
  return null
}
const percentile = (values, p) => {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)]
}
const numericCost = (trace) => {
  const value = trace?.metadata?.costUsd ?? trace?.metadata?.cost ?? trace?.costUsd
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0
}
const eventData = (trace) => (trace?.events || []).map((event) => event?.data || {})
const errorKeys = (trace) => eventData(trace)
  .flatMap((data) => [data.code, data.error, data.errorCode, data.type])
  .filter(Boolean)
  .map(String)

export function summarizeObservability({ hotelId, traces = [], now = new Date().toISOString(), staleAfterMs = 15 * 60 * 1000 } = {}) {
  if (!String(hotelId || '').trim()) throw new TypeError('hotelId is required')
  const nowMs = new Date(now).getTime()
  const scoped = traces.filter((trace) => hotelOf(trace) === hotelId).map(clone)
  const durations = scoped.map(durationOf).filter((value) => value != null)
  const terminal = scoped.filter((trace) => trace.status !== TraceStatus.RUNNING)
  const succeeded = scoped.filter((trace) => trace.status === TraceStatus.SUCCEEDED).length
  const failed = scoped.filter((trace) => trace.status === TraceStatus.FAILED).length
  const running = scoped.filter((trace) => trace.status === TraceStatus.RUNNING)
  const stale = running.filter((trace) => Number.isFinite(nowMs) && Number.isFinite(new Date(trace.startedAt).getTime()) && nowMs - new Date(trace.startedAt).getTime() > staleAfterMs)
  const errors = new Map()
  for (const trace of scoped) for (const key of errorKeys(trace)) errors.set(key, (errors.get(key) || 0) + 1)
  const topErrors = [...errors.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, 5)
  const spans = scoped.flatMap((trace) => trace.spans || [])
  const failedSpans = spans.filter((span) => span.status === SpanStatus.FAILED)
  const totalCostUsd = scoped.reduce((sum, trace) => sum + numericCost(trace), 0)
  const successRate = terminal.length ? Number((succeeded / terminal.length).toFixed(4)) : null
  const health = failed || stale.length ? 'DEGRADED' : running.length ? 'ACTIVE' : scoped.length ? 'HEALTHY' : 'NO_DATA'
  return {
    hotelId,
    generatedAt: now,
    health,
    scope: { included: scoped.length, excluded: traces.length - scoped.length },
    counts: { traces: scoped.length, succeeded, failed, running: running.length, stale: stale.length, spans: spans.length, failedSpans: failedSpans.length },
    successRate,
    latencyMs: { average: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null, p95: percentile(durations, 0.95) },
    costUsd: { total: Number(totalCostUsd.toFixed(6)), measuredTraces: scoped.filter((trace) => numericCost(trace) > 0).length },
    topErrors,
    staleTraceIds: stale.map((trace) => trace.id),
    recommendations: [
      ...(stale.length ? [{ id: 'stale-traces', priority: 'high', message: 'Verificare i trace rimasti RUNNING oltre la soglia: potrebbero indicare worker bloccati o callback mancanti.' }] : []),
      ...(failed ? [{ id: 'failed-traces', priority: 'high', message: 'Aprire gli errori principali e controllare il percorso di recovery prima di aumentare l’autonomia.' }] : []),
      ...(!scoped.length ? [{ id: 'no-data', priority: 'medium', message: 'Nessun trace osservabile per questo hotel: verificare che il percorso RandAI emetta telemetria.' }] : []),
    ],
  }
}

export const OBSERVABILITY_HEALTH = Object.freeze({ HEALTHY: 'HEALTHY', ACTIVE: 'ACTIVE', DEGRADED: 'DEGRADED', NO_DATA: 'NO_DATA' })
