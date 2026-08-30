import { TraceStatus, SpanStatus, validateTrace } from './contracts.js'
import { TraceStore } from './store.js'

const clone = (value) => structuredClone(value)
const nowIso = () => new Date().toISOString()
const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`

export class ObservabilityEngine {
  constructor({ store = new TraceStore() } = {}) { this.store = store }

  async startTrace({ name, projectId = 'randai', taskId = null, metadata = {} } = {}) {
    if (!name) throw new TypeError('trace name is required')
    const trace = { id: makeId('TRACE'), name, projectId, taskId, status: TraceStatus.RUNNING, startedAt: nowIso(), endedAt: null, spans: [], events: [], metadata: clone(metadata) }
    await this.store.save(trace)
    return clone(trace)
  }

  async startSpan(traceId, { name, kind = 'INTERNAL', parentSpanId = null, metadata = {} } = {}) {
    const trace = await this.#require(traceId)
    if (trace.status !== TraceStatus.RUNNING) throw new Error(`Trace is not running: ${trace.status}`)
    const span = { id: makeId('SPAN'), name, kind, parentSpanId, status: SpanStatus.RUNNING, startedAt: nowIso(), endedAt: null, durationMs: null, metadata: clone(metadata), events: [] }
    trace.spans.push(span)
    validateTrace(trace)
    await this.store.save(trace)
    return clone(span)
  }

  async endSpan(traceId, spanId, { status = SpanStatus.SUCCEEDED, metadata = {} } = {}) {
    const trace = await this.#require(traceId)
    const span = trace.spans.find((item) => item.id === spanId)
    if (!span) throw new Error(`Unknown span: ${spanId}`)
    span.status = status
    span.endedAt = nowIso()
    span.durationMs = Math.max(0, new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime())
    span.metadata = { ...span.metadata, ...clone(metadata) }
    await this.store.save(trace)
    return clone(span)
  }

  async emit(traceId, type, data = {}, { spanId = null } = {}) {
    const trace = await this.#require(traceId)
    const event = { type, at: nowIso(), spanId, data: clone(data) }
    trace.events.push(event)
    if (spanId) trace.spans.find((item) => item.id === spanId)?.events.push(clone(event))
    await this.store.save(trace)
    return clone(event)
  }

  eventSink(traceId, { spanId = null } = {}) {
    return (event) => this.emit(traceId, event.type || 'EVENT', event, { spanId }).catch(() => {})
  }

  async completeTrace(traceId, { ok = true, metadata = {} } = {}) {
    const trace = await this.#require(traceId)
    trace.status = ok ? TraceStatus.SUCCEEDED : TraceStatus.FAILED
    trace.endedAt = nowIso()
    trace.metadata = { ...trace.metadata, ...clone(metadata) }
    await this.store.save(trace)
    return clone(trace)
  }

  async progress(traceId, { weights = {} } = {}) {
    const trace = await this.#require(traceId)
    const spans = trace.spans
    const total = spans.reduce((sum, span) => sum + Number(weights[span.name] || 1), 0)
    const completed = spans.filter((span) => [SpanStatus.SUCCEEDED, SpanStatus.FAILED].includes(span.status)).reduce((sum, span) => sum + Number(weights[span.name] || 1), 0)
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
