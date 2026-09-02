import { TraceStatus, SpanStatus, validateTrace } from './contracts.js'
import { TraceStore } from './store.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()
const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

function spanWeight(weights, name) {
  const value = weights[name] ?? 1
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) throw new TypeError(`Invalid observability weight for ${name}`)
  return numeric
}

export class ObservabilityEngine {
  constructor({ store = new TraceStore(), onTelemetryError = null } = {}) {
    if (onTelemetryError != null && typeof onTelemetryError !== 'function') throw new TypeError('onTelemetryError must be a function')
    this.store = store
    this.onTelemetryError = onTelemetryError
  }

  async startTrace({ name, projectId = 'randai', taskId = null, metadata = {} } = {}) {
    if (!String(name || '').trim()) throw new TypeError('trace name is required')
    const trace = { id: makeId('TRACE'), name: String(name).trim(), projectId, taskId, status: TraceStatus.RUNNING, startedAt: nowIso(), endedAt: null, spans: [], events: [], metadata: clone(metadata) }
    validateTrace(trace)
    await this.store.save(trace)
    return clone(trace)
  }

  async startSpan(traceId, { name, kind = 'INTERNAL', parentSpanId = null, metadata = {} } = {}) {
    if (!String(name || '').trim()) throw new TypeError('span name is required')
    const trace = await this.#require(traceId)
    if (trace.status !== TraceStatus.RUNNING) throw new Error(`Trace is not running: ${trace.status}`)
    const span = { id: makeId('SPAN'), name: String(name).trim(), kind, parentSpanId, status: SpanStatus.RUNNING, startedAt: nowIso(), endedAt: null, durationMs: null, metadata: clone(metadata), events: [] }
    trace.spans.push(span)
    validateTrace(trace)
    await this.store.save(trace)
    return clone(span)
  }

  async endSpan(traceId, spanId, { status = SpanStatus.SUCCEEDED, metadata = {} } = {}) {
    if (![SpanStatus.SUCCEEDED, SpanStatus.FAILED].includes(status)) throw new TypeError(`Invalid terminal span status: ${status}`)
    const trace = await this.#require(traceId)
    if (trace.status !== TraceStatus.RUNNING) throw new Error(`Trace is not running: ${trace.status}`)
    const span = trace.spans.find((item) => item.id === spanId)
    if (!span) throw new Error(`Unknown span: ${spanId}`)
    if (span.status !== SpanStatus.RUNNING || span.endedAt) throw new Error(`Span is already terminal: ${spanId}`)
    span.status = status
    span.endedAt = nowIso()
    span.durationMs = Math.max(0, new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime())
    span.metadata = { ...span.metadata, ...clone(metadata) }
    validateTrace(trace)
    await this.store.save(trace)
    return clone(span)
  }

  async emit(traceId, type, data = {}, { spanId = null } = {}) {
    if (!String(type || '').trim()) throw new TypeError('event type is required')
    const trace = await this.#require(traceId)
    if (spanId && !trace.spans.some((item) => item.id === spanId)) throw new Error(`Unknown event span: ${spanId}`)
    const event = { type: String(type).trim(), at: nowIso(), spanId, data: clone(data) }
    trace.events.push(event)
    if (spanId) trace.spans.find((item) => item.id === spanId).events.push(clone(event))
    validateTrace(trace)
    await this.store.save(trace)
    return clone(event)
  }

  eventSink(traceId, { spanId = null } = {}) {
    return async (event) => {
      try {
        return await this.emit(traceId, event?.type || 'EVENT', event || {}, { spanId })
      } catch (error) {
        try { await this.onTelemetryError?.({ traceId, spanId, error, event: clone(event || {}) }) } catch {}
        return null
      }
    }
  }

  async completeTrace(traceId, { ok = true, cancelled = false, metadata = {} } = {}) {
    const trace = await this.#require(traceId)
    if (trace.status !== TraceStatus.RUNNING) throw new Error(`Trace is already terminal: ${trace.status}`)
    const openSpans = trace.spans.filter((span) => span.status === SpanStatus.RUNNING)
    if (openSpans.length) throw new Error(`Trace has open spans: ${openSpans.map((span) => span.id).join(', ')}`)
    trace.status = cancelled ? TraceStatus.CANCELLED : (ok ? TraceStatus.SUCCEEDED : TraceStatus.FAILED)
    trace.endedAt = nowIso()
    trace.metadata = { ...trace.metadata, ...clone(metadata) }
    validateTrace(trace)
    await this.store.save(trace)
    return clone(trace)
  }

  async progress(traceId, { weights = {} } = {}) {
    const trace = await this.#require(traceId)
    const spans = trace.spans
    const total = spans.reduce((sum, span) => sum + spanWeight(weights, span.name), 0)
    const completed = spans.filter((span) => [SpanStatus.SUCCEEDED, SpanStatus.FAILED].includes(span.status)).reduce((sum, span) => sum + spanWeight(weights, span.name), 0)
    return { completedWeight: completed, totalWeight: total, percent: total ? Math.round((completed / total) * 100) : 0 }
  }

  async get(traceId) { return this.store.get(traceId) }
  async list(filters = {}) { return this.store.list(filters) }

  async #require(id) {
    const trace = await this.store.get(id)
    if (!trace) throw new Error(`Unknown trace: ${id}`)
    return trace
  }
}
